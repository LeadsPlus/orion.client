/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define setTimeout*/
define(["orion/assert", "orion/test", "orion/Deferred", "orion/xhr", "orion/textview/eventTarget"],
		function(assert, mTest, Deferred, xhr, mEventTarget) {
	var EventTarget = mEventTarget.EventTarget;
	/**
	 * Fake version of XMLHttpRequest for testing without actual network accesses.
	 */
	function MockXMLHttpRequest() {
		this.readyState = 0;
		this.headers = {};
	}
	MockXMLHttpRequest.prototype = {
		open: function() {
		},
		send: function() {
		},
		setRequestHeader: function(name, value) {
			this.headers[name] = value;
		},
		_setReadyState: function(value) {
			this.readyState = value;
			if (typeof this.onreadystatechange === 'function') {
				this.onreadystatechange();
			}
		},
		_setResponse: function(response) {
			this.response = response;
		},
		_setStatus: function(status) {
			this.status = status;
		},
		_fakeComplete: function(status, response) {
			this._setStatus(status);
			this._setResponse(response);
			this._setReadyState(4);
		},
		_fakeTimeout: function(err) {
			this.dispatchEvent({type: 'timeout'});
		}
	};
	EventTarget.addMixin(MockXMLHttpRequest.prototype);

	/** A mock XHR request that succeeds. */
	function OkXhr() {
		MockXMLHttpRequest.apply(this, Array.prototype.slice.call(arguments));
		this.send = function() {
			var self = this;
			setTimeout(function() {
				self._fakeComplete(200, 'success!');
			}, 75);
		};
	}
	OkXhr.prototype = new MockXMLHttpRequest();

	/** A mock XHR request that 404s. */
	function FailXhr() {
		MockXMLHttpRequest.apply(this, Array.prototype.slice.call(arguments));
		this.send = function() {
			var self = this;
			setTimeout(function() {
				self._fakeComplete(404, 'i failed');
			}, 100);
		};
	}
	FailXhr.prototype = new MockXMLHttpRequest();

	function resolve(result) {
		var d = new Deferred();
		d.resolve.apply(d, Array.prototype.slice.call(arguments));
		return d;
	}

	function reject(err) {
		var d = new Deferred();
		d.resolve.apply(d, Array.prototype.slice.call(arguments));
		return d;
	}

	/**
	 * Wraps a test body to ensure a test failure if the promise doesn't resolve.
	 * @param {Function} func The test body (must return a promise).
	 * @returns {Deferred}
	 */
	function withTimeout(func) {
		return function() {
			var wrapper = new Deferred();
			var inner;
			var innerPromiseFired = false;
			try {
				inner = func();
				setTimeout(function() {
					if (!innerPromiseFired) {
						wrapper.reject('Timed out');
					}
				}, 3000);
				inner.then(
					function(result) {
						innerPromiseFired = true;
						wrapper.resolve(result);
					}, function(err) {
						innerPromiseFired = true;
						wrapper.reject(err);
					});
			} catch (e) {
				wrapper.reject(e);
			}
			return wrapper;
		};
	}

	var tests = {};
	tests['test GET resolve'] = withTimeout(function() {
		return xhr('GET', '/', null, new OkXhr()).then(resolve, reject);
	});

	tests['test GET reject'] = withTimeout(function() {
		return xhr('GET', '/bogus/url/that/doesnt/exist', null, new FailXhr()).then(reject, resolve);
	});

	tests['test GET query params'] = withTimeout(function() {
		return xhr('GET', '/', {
			query: {
				'foo': 3,
				'bar': 'baz'
			}
		}).then(function(result) {
			assert.strictEqual(result.url, '/?foo=3&bar=baz', null, new OkXhr());
		}, reject);
	});

	tests['test GET query params encoding'] = withTimeout(function() {
		return xhr('GET', '/', {
			query: {
				'foo!bar': 31337,
				'baz': 'fizz buzz'
			}
		}).then(function(result) {
			assert.strictEqual(result.url, '/?foo%21bar=31337&baz=fizz%20buzz', null, new OkXhr());
		}, reject);
	});

	tests['test GET query params with fragment'] = withTimeout(function() {
		return xhr('GET', '/#some?junk&we?dont&care?about', {
			query: {
				'foo*bar': 'baz',
				'quux': 'a b'
			}
		}).then(function(result) {
			assert.strictEqual(result.url, '/?foo%2Abar=baz&quux=a%20b#some?junk&we?dont&care?about', null, new OkXhr());
		}, reject);
	});

	tests['test GET query params with existing params and fragment'] = withTimeout(function() {
		return xhr('GET', '/?a%20=b#some?junk&we?dont&care?about', {
			query: {
				'foo*bar': 'baz'
			}
		}).then(function(result) {
			assert.strictEqual(result.url, '/?a%20=b&foo%2Abar=baz#some?junk&we?dont&care?about', null, new OkXhr());
		}, reject);
	});

return tests;
});