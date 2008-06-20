// 文字列等に非ASCII文字を使う場合は、ファイルのエンコーディングを
// UTF-8にしてください。

utils.include('common.inc.js');
utils.include('quickfind.inc.js');

var quickFindDetailTest = new TestCase('クイックMigemo検索の詳細テスト', {runStrategy: 'async'});

quickFindDetailTest.tests = {
	setUp : function() {
		yield Do(commonSetUp(keyEventTest));
		assert.isTrue(XMigemoUI.findBarHidden);
	},

	tearDown : function() {
		commonTearDown();
	},

	'Migemo検索モードからクイックMigemo検索を実行した場合': function() {
		XMigemoUI.autoStartQuickFind = true;

		gFindBar.openFindBar();
		yield wait;
		XMigemoUI.findMode = XMigemoUI.FIND_MODE_MIGEMO;
		yield wait;
		gFindBar.closeFindBar();
		yield wait;

		var findTerm = 'nihongo';
		yield Do(assert.autoStart('nihongo'));
		yield Do(assert.timeout(XMigemoUI.FIND_MODE_MIGEMO));
	},

	'文字入力操作でタイマーが正しくリセットされるか': function() {
		XMigemoUI.autoStartQuickFind = true;

		var findTerm = 'nihongoNoTekisuto';
		yield Do(assert.autoStart(findTerm.charAt(0)));

		var startAt = (new Date()).getTime();

		var lastInput = XMigemoUI.findTerm;
		var key;
		for (var i = 1, maxi = findTerm.length+1; i < maxi; i++)
		{
			key = { charCode : findTerm.charCodeAt(i) };
			action.fireKeyEventOnElement(findField, key);
			yield wait;
			assert.equals(lastInput+findTerm.charAt(i), XMigemoUI.findTerm);
			lastInput = XMigemoUI.findTerm;
			if (((new Date()).getTime() - startAt) > XMigemoUI.timeout) break;
		}
		assert.isQuickMigemoFindActive();

		action.inputTextToField(findField, findTerm);
		yield wait;

		startAt = (new Date()).getTime();
		while (((new Date()).getTime() - startAt) < XMigemoUI.timeout)
		{
			assert.isQuickMigemoFindActive();
			action.fireKeyEventOnElement(findField, key_RETURN);
			yield wait;
		}

		startAt = (new Date()).getTime();
		lastInput = XMigemoUI.findTerm;
		key = { keyCode : Components.interfaces.nsIDOMKeyEvent.DOM_VK_BACK_SPACE };
		for (var i = findTerm.length; i > 0; i--)
		{
			action.fireKeyEventOnElement(findField, key_BS);
			yield wait;
			assert.equals(lastInput.substring(0, lastInput.length-1), XMigemoUI.findTerm);
			lastInput = XMigemoUI.findTerm;
			if (((new Date()).getTime() - startAt) > XMigemoUI.timeout) break;
		}
		assert.isQuickMigemoFindActive();
	},

	'クイックMigemo検索実行中にテキストエリアにフォーカス': function() {
		XMigemoUI.autoStartQuickFind = true;

		var findTerm = 'foobar';
		yield Do(assert.autoStart(findTerm));

		var input = content.document.getElementsByTagName('input')[0];
		input.focus();
		action.fireMouseEventOnElement(input);
		yield wait;
		assert.isTrue(XMigemoUI.findBarHidden);

		var originalValue = input.value;
		var focused = win.document.commandDispatcher.focusedElement;
		action.fireKeyEventOnElement(focused, key_input_a);
		yield wait;
		assert.equals(originalValue+'a', focused.value);
	},

	'クイックMigemo検索で通常の文字列にヒットした後に再びクイックMigemo検索': function() {
		XMigemoUI.autoStartQuickFind = true;

		var findTerm = 'multirow';
		yield Do(assert.autoStart(findTerm));
		yield Do(assert.timeout());
		yield Do(assert.autoStart(findTerm.charAt(0)));
	}
};