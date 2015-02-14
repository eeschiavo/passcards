import underscore = require('underscore');

import assign = require('../../lib/base/assign');
import details_view = require('../details_view');
import event_stream = require('../../lib/base/event_stream');
import item_store = require('../../lib/item_store');
import sync = require('../../lib/sync');

export interface State {
	store?: item_store.Store;
	items?: item_store.Item[];
	selectedItem?: item_store.Item;
	itemEditMode?: details_view.ItemEditMode;
	isLocked?: boolean;

	// TODO - Current URL state should live elsewhere
	currentUrl?: string;
	syncer?: sync.Syncer;
	syncState?: sync.SyncProgress;
}

/** Maintains the state of the currently
  * opened password item store.
  */
export class Store {
	stateChanged: event_stream.EventStream<State>;
	state: State;
	
	private syncListener: event_stream.EventListener<sync.SyncProgress>;

	constructor() {
		this.stateChanged = new event_stream.EventStream<State>();
		this.state = {
			items: [],
			selectedItem: null,
			itemEditMode: details_view.ItemEditMode.EditItem,
			isLocked: true,
			currentUrl: '',
			store: null,
			syncer: null
		};
		this.syncListener = (progress: sync.SyncProgress) => {
			this.update({ syncState: progress });
		};
	}

	update(state?: State) {
		var nextState = assign<State>({}, this.state, state);

		// listen for updates to items in the store
		var doRefresh = false;
		if (nextState.currentUrl !== this.state.currentUrl) {
			nextState.selectedItem = null;
		}

		if (nextState.isLocked !== this.state.isLocked &&
			nextState.isLocked === false) {
			nextState.selectedItem = null;
			nextState.items = [];
			doRefresh = true;
		}

		if (nextState.syncer !== this.state.syncer) {
			if (this.state.syncer) {
				this.state.syncer.onProgress.ignoreContext(this);
			}
			if (nextState.syncer) {
				nextState.syncer.onProgress.listen(this.syncListener, this);
			}
		}

		if (nextState.store !== this.state.store) {
			var debouncedRefresh = underscore.debounce(() => {
				if (this.state.store && !this.state.isLocked) {
					this.refreshItems();
				}
			}, 300);

			if (this.state.store) {
				this.state.store.onItemUpdated.ignoreContext(this);
			}
			if (nextState.store) {
				nextState.store.onItemUpdated.listen(debouncedRefresh, this);
			}
		}

		if (doRefresh) {
			this.refreshItems();
		}
		
		this.state = assign(this.state, state);
		this.stateChanged.publish(state);
	}

	private refreshItems() {
		if (!this.state.store) {
			return;
		}
		this.state.store.listItems().then((items) => {
			var visibleItems = items.filter((item) => {
				return item.isRegularItem() && !item.trashed;
			});
			this.update({items: visibleItems});
		}).catch((err) => {
			console.log('Error listing items: ', err);
		});
	}
}

