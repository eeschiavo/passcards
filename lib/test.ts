/// <reference path="../typings/DefinitelyTyped/node/node.d.ts" />
/// <reference path="../typings/xdiff.d.ts" />

var qunit = require('qunitjs');
import xdiff = require('xdiff');

export interface Assert {
	equal(actual: any, expected: any, message: string) : void;
	ok(result: boolean) : void;
}

export function addTest(name : string, testFunc : (assert: Assert) => void) {
	qunit.test(name, testFunc);
}

export function addAsyncTest(name : string, testFunc : (assert: Assert) => void) {
	qunit.asyncTest(name, testFunc);
}

export function continueTests() {
	qunit.start();
}

export function runTests() {
	qunit.log((details: any) => {
		if (!details.result) {
			console.log('test failed');
			console.log(details);
		}
	});

	qunit.done((result: any) => {
		console.log('tests run. total: ' + result.total + ' failed: ' + result.failed);
		if (typeof process != 'undefined') {
			if (result.failed > 0) {
				process.exit(1)
			} else {
				process.exit(0);
			}
		}
	});

	if (typeof window == 'undefined') {
		qunit.load();
	}
}

/** Compares two values (objects or arrays) and outputs a diff
 * between 'a' and 'b', excluding
 * any keys which are expected to have been added in 'b' and
 * any keys which are expected to have been removed in 'b'
 * expectedAdditions and expectedDeletions are arrays of '/'-separated paths
 * beginning with 'root/'
 */
export function compareObjects(a: any, b: any, expectedAdditions?: string[], expectedDeletions?: string[]) : any[] {
	var diff = xdiff.diff(a, b);
	if (!diff) {
		// objects are exactly equal
		return [];
	}

	var additions : string[] = [];
	var deletions : string[] = [];

	expectedAdditions = expectedAdditions || [];
	expectedDeletions = expectedDeletions || [];

	return diff.filter((change: any[]) => {
		var type : string = change[0];
		var path : string = change[1].join('/');

		if (type == 'set' && expectedAdditions.indexOf(path) != -1) {
			return false;
		} else if (type == 'del' && expectedDeletions.indexOf(path) != -1) {
			return false
		}
		return true;
	});
}

