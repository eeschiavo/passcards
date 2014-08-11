/// <reference path="../typings/DefinitelyTyped/underscore/underscore.d.ts" />
/// <reference path="../typings/URIjs.d.ts" />
/// <reference path="../typings/dom.d.ts" />

import underscore = require('underscore');
import urijs = require('URIjs');

import err_util = require('../lib/base/err_util');
import event_stream = require('../lib/base/event_stream');
import key_value_store = require('../lib/base/key_value_store');
import site_info = require('../lib/siteinfo/site_info');
import url_util = require('../lib/base/url_util');

/** Fetch state for an icon returned by ItemIconProvider query.
  */
export enum IconFetchState {
	Fetching, ///< Icons associated with the URL are currently being fetched
	NoIcon, ///< The fetch completed but no matching icon was found
	Found ///< The fetch completed and found an icon
}

export interface ItemIcon {
	iconUrl: string;
	state: IconFetchState;
}

/** Provides icon URLs for items.
  *
  * Call query(url) to lookup the icon associated with a given URL.
  * If a cached icon is available, it will be returned, otherwise a lookup
  * will be triggered.
  *
  * When the icon associated with a previously looked up URL changes,
  * the updated event stream will emit the normalized URL.
  */
export class ItemIconProvider {
	private tempCache: {
		[index: string] : ItemIcon;
	};
	private diskCache : Cache;
	private provider: site_info.SiteInfoProvider;
	private iconSize: number;

	/** Stream of icon update events.
	  * Emits the normalized URL (using url_util.normalize) of the location
	  * when the icon for that location is updated.
	  */
	updated: event_stream.EventStream<string>;
	
	/** Create an icon provider which uses @p provider to fetch
	  * icon data. @p iconSize specifies the size of icon to make from
	  * the available icons for a given URL.
	  *
	  * @param cacheStore A key/value store to use for persisting fetched icons
	  * @param provider A provider to query for icons for a given domain
	  * @param iconSize The preferred size for icons generated by the provider.
	  *                 Depending on the images that can be retrieved for a URL,
	  *                 the actual icon image may be larger or smaller than the preferred
	  *                 size.
	  */
	constructor(cacheStore: key_value_store.Store, provider: site_info.SiteInfoProvider, iconSize: number) {
		this.tempCache = {};
		this.diskCache = new Cache(cacheStore);
		this.provider = provider;
		this.iconSize = iconSize;
		this.updated = new event_stream.EventStream<string>();

		this.provider.updated.listen((url) => {
			var entry = this.provider.status(url);

			if (entry.state == site_info.QueryState.Ready) {
				var icon = this.tempCache[url];
				icon.iconUrl = this.makeIconUrl(entry.info.icons, this.iconSize);
				if (icon.iconUrl != '') {
					icon.state = IconFetchState.Found;
				} else {
					icon.state = IconFetchState.NoIcon;
				}
				this.updated.publish(url);

				if (entry.info.icons.length == 0) {
					// if a query against the actual location returns no suitable icons,
					// try a query against the main domain
					var fallbackUrl = this.fallbackUrlForIcon(url);
					if (fallbackUrl && fallbackUrl != url) {
						this.query(this.fallbackUrlForIcon(url));
					}
				}

				// cache icons for future use
				this.diskCache.insert(url, {
					icons: entry.info.icons
				}).fail((err) => {
					console.log('Caching icons for URL', url, 'failed', err.message);
				});

				// free icon data
				this.provider.forget(url);
			}
		});
	}

	/** Returns true if a given @p updateUrl from ItemIconProvider.updated
	  * matches an item with location @p location.
	  *
	  * The update URL may not match the original item location due to
	  * normalization or if a fallback URL has been used to find
	  * an icon for the item.
	  */
	updateMatches(updateUrl: string, itemUrl: string) {
		itemUrl = url_util.normalize(itemUrl);
		return updateUrl == itemUrl ||
		       updateUrl == this.fallbackUrlForIcon(itemUrl);
	}

	/** Fetch the icon for a given URL. */
	query(url: string) : ItemIcon {
		url = url_util.normalize(url);

		if (url.length == 0) {
			return {
				iconUrl: 'loading.png',
				state: IconFetchState.NoIcon
			}
		}

		if (this.tempCache.hasOwnProperty(url)) {
			var cachedIcon = this.tempCache[url];
			if (cachedIcon.state == IconFetchState.NoIcon) {
				var fallbackUrl = this.fallbackUrlForIcon(url);
				if (this.tempCache.hasOwnProperty(fallbackUrl)) {
					return this.tempCache[fallbackUrl];
				}
			}
			return cachedIcon;
		} else {
			var icon : ItemIcon = {
				iconUrl: 'loading.png',
				state: IconFetchState.Fetching
			};
			this.tempCache[url] = icon;
			
			this.diskCache.query(url).then((entry) => {
				this.updateCacheEntry(url, entry.icons);
			}).fail((err) => {
				console.log('Disk cache lookup for', url, 'failed:', err, err.message);
				this.provider.lookup(url);
			});

			return icon;
		}
	}

	private updateCacheEntry(url: string, icons: site_info.Icon[]) {
		var icon = this.tempCache[url];
		icon.iconUrl = this.makeIconUrl(icons, this.iconSize);
		if (icon.iconUrl != '') {
			icon.state = IconFetchState.Found;
		} else {
			icon.state = IconFetchState.NoIcon;
		}
		this.updated.publish(url);

		if (icons.length == 0) {
			// if a query against the actual location returns no suitable icons,
			// try a query against the main domain
			var fallbackUrl = this.fallbackUrlForIcon(url);
			if (fallbackUrl && fallbackUrl != url) {
				this.query(this.fallbackUrlForIcon(url));
			}
		}
	}

	// Take a set of icons for a site, pick the best one for a given target
	// image width of @p minSize and return a blob URL for the image
	// data
	private makeIconUrl(icons: site_info.Icon[], minSize: number) {
		if (icons.length == 0) {
			return '';
		}

		var iconsBySize = underscore.sortBy(icons, (icon) => {
			return icon.width;
		});

		// try to find a square icon of the required-size
		var squareIcon: site_info.Icon;
		var nonSquareIcon: site_info.Icon;

		for (var i=0; i < iconsBySize.length; i++) {
			var candidate = iconsBySize[i];
			if (candidate.width >= minSize) {
				if (candidate.width == candidate.height) {
					squareIcon = squareIcon || candidate;
				} else {
					nonSquareIcon = nonSquareIcon || candidate;
				}
			}
		}

		var icon = squareIcon || nonSquareIcon;
		if (!icon) {
			icon = iconsBySize[iconsBySize.length-1];
		}
		
		// FIXME - TypeScript ctor for Blob
		// is missing arguments
		var iconBlob = new Blob([icon.data]);
		var blobUrl = URL.createObjectURL(iconBlob);

		return blobUrl;
	}

	// Returns a fallback URL to try if querying an item's URL does
	// not return an icon.
	//
	// (eg. 'https://sub.domain.com/foo/bar' => 'https://www.domain.com')
	//
	// We use HTTPS here although there are many sites which do have secure
	// login pages but whoose main site is not reachable over HTTPS
	// due to an invalid certificate or simply lack of SSL support.
	//
	// We could try an HTTP-only variant of the lookup but this is open
	// to MITM spoofing if run from the user's system.
	//
	private fallbackUrlForIcon(url: string) {
		url = url_util.normalize(url);
		var parsedUrl = urijs(url);
		return 'https://www.' + parsedUrl.domain();
	}
}

interface CacheEntry {
	icons: site_info.Icon[];
}

class Cache {
	constructor(private store: key_value_store.Store) {
	}

	query(url: string) : Q.Promise<CacheEntry> {
		return this.withKey(url, (key) => {
			return this.store.get<CacheEntry>(key);
		});
	}

	insert(url: string, icons: CacheEntry) : Q.Promise<void> {
		return this.withKey(url, (key) => {
			return this.store.set(key, icons);
		});
	}

	clear(url: string) : Q.Promise<void> {
		return this.withKey(url, (key) => {
			return this.store.remove(key);
		});
	}

	private withKey<T>(url: string, f: (key: string) => Q.Promise<T>) : Q.Promise<T> {
		var key = urijs(url_util.normalize(url)).hostname();
		if (!key) {
			return Q.reject(new err_util.BaseError('Invalid URL'));
		}
		return f(key);
	}
}

