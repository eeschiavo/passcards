import react = require('react');
import react_addons = require('react/addons');
import typed_react = require('typed-react');

import button = require('./controls/button');
import item_field = require('./item_field');
import page_access = require('./page_access');
import testLib = require('../lib/test');
import ui_test_utils = require('./test_utils');

let reactTestUtils = react_addons.addons.TestUtils;

let fakeClipboard: page_access.ClipboardAccess = {
	clipboardAvailable() {
		return true;
	},

	copy(type: string, data: string) {
		// not implemented
	}
};

class AccountFields extends typed_react.Component<{}, {}> {
	render() {
		return react.DOM.div({}, item_field.ItemFieldF({
			ref: 'usernameField',
			label: 'Username',
			value: 'jimjones',
			type: item_field.FieldType.Text,
			clipboard: fakeClipboard,
			readOnly: false,
			onChange: newValue => false
		}),
			item_field.ItemFieldF({
				ref: 'passwordField',
				label: 'Password',
				value: 'secret',
				type: item_field.FieldType.Password,
				clipboard: fakeClipboard,
				readOnly: false,
				onChange: newValue => false
			}));
	}
};

let AccountFieldsF = react.createFactory(AccountFields);

testLib.addTest('should display field actions when focused', assert => {
	ui_test_utils.runReactTest(element => {
		let renderField = () => react.render(AccountFieldsF({}), element);

		let field = renderField();

		// when initially displayed, no actions should be selected
		let buttons = reactTestUtils.scryRenderedComponentsWithType(field,
			button.ButtonF.componentClass);
		assert.equal(buttons.length, 0);

		// now give focus to the field and update.
		// The focus event here is dispatched using dispatchEvent() rather than
		// reactTestUtils.Simulate.focus() because ItemField watches focus/blur
		// events for the whole document rather than using onFocus/onBlur handlers
		// on the component itself, in order to determine when the field loses
		// focus to another field
		let usernameField = field.refs['usernameField'];
		let usernameFieldInput = <HTMLElement>react.findDOMNode(usernameField.refs['textField']);
		let passwordField = field.refs['passwordField'];
		let passwordFieldInput = <HTMLElement>react.findDOMNode(passwordField.refs['textField']);

		// unlike the browser,
		// jsdom 6.1.0 does not automatically send a 'focus' event to an element
		// when it gains focus
		let event: typeof Event = (<any>window).Event;
		passwordFieldInput.dispatchEvent(new event('focus'));

		let actionButtons = (field: react.Component<{}, {}>) => reactTestUtils.scryRenderedComponentsWithType(field,
			button.ButtonF.componentClass);

		assert.equal(actionButtons(passwordField).length, 3);

		// select a different field and verify that the action buttons are hidden
		usernameFieldInput.dispatchEvent(new event('focus'));
		assert.equal(actionButtons(passwordField).length, 0);
		assert.equal(actionButtons(usernameField).length, 1);

		// re-select the password field, check that action buttons are shown
		passwordFieldInput.dispatchEvent(new event('focus'));
		// select the document body and verify that the action buttons are still visible
		document.body.dispatchEvent(new event('focus'));
		assert.equal(actionButtons(passwordField).length, 3);
		assert.equal(actionButtons(usernameField).length, 0);
	});
});