import react_dom = require('react-dom');
import test_utils = require('react-dom/test-utils');
import { Component } from 'react';

import item_builder = require('../lib/item_builder');
import item_list_view = require('./item_list_view');
import item_icons = require('./item_icons');
import testLib = require('../lib/test');
import ui_test_utils = require('./test_utils');

var testItems = [
    item_builder.createItem({
        title: 'Apple',
        username: 'jim.smith@gmail.com',
        password: 'abc',
        url: 'https://www.icloud.com',
    }),
    item_builder.createItem({
        title: 'Gmail',
        username: 'jim.smith@gmail.com',
        password: 'def',
        url: 'https://www.gmail.com',
    }),
];

testLib.addTest('should display store items', assert => {
    return ui_test_utils.runReactTest(element => {
        return new Promise(resolve => {
            var checkRender = (itemList: React.Component) => {
                var renderedItems = test_utils.scryRenderedComponentsWithType(
                    itemList,
                    item_list_view.Item
                );
                assert.equal(renderedItems.length, testItems.length);
                resolve();
            };

            var itemList: React.Component;
            react_dom.render(
                item_list_view.ItemListViewF({
                    items: testItems,
                    selectedItem: null,
                    onSelectedItemChanged: (item, rect) => {},
                    currentUrl: '',
                    iconProvider: new item_icons.FakeIconProvider(),
                    focus: false,
                    ref: (component: any) => (itemList = component),
                    onLockClicked: () => {},
                    onMenuClicked: e => {},
                }),
                element
            );

            // ItemListView currently updates the list of matching and visible
            // items asynchronously after the first render. The initial
            // render will have no visible items and the expected items will
            // only be present after a second async render.
            setTimeout(() => checkRender(itemList), 1);
        });
    });
});

testLib.addTest('should display item details', assert => {
    ui_test_utils.runReactTest(element => {
        var itemSelected = false;
        var iconProvider = new item_icons.FakeIconProvider();

        var renderItem = () => {
            return react_dom.render(
                item_list_view.ItemF({
                    key: 'item',
                    item: testItems[0],
                    onSelected: () => {
                        itemSelected = true;
                    },
                    isFocused: false,
                    iconProvider: iconProvider,
                    index: 0,
                    offsetTop: 0,
                }),
                element
            );
        };

        // should render icon with site's primary location
        var itemComponent = renderItem() as any;
        var iconComponent = test_utils.findRenderedComponentWithType(
            itemComponent as any,
            item_icons.IconControl
        ) as any;
        assert.equal(
            iconComponent.props.location,
            testItems[0].primaryLocation()
        );

        // should invoke onSelected() handler when clicked
        assert.equal(itemSelected, false);
        var rootNode = itemComponent.refs['itemOverview'];
        test_utils.Simulate.click(rootNode as Component<any, any>);
        assert.equal(itemSelected, true);
    });
});
