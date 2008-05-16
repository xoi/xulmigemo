// 文字列等に非ASCII文字を使う場合は、ファイルのエンコーディングを
// UTF-8にしてください。

utils.include('common.inc');
utils.include('quickfind.inc');

var quickFindBasicTest = new TestCase('クイックMigemo検索の基本テスト', {runStrategy: 'async'});

quickFindBasicTest.tests = {
	setUp : function() {
		yield Do(commonSetUp(keyEventTest));
		assert.isTrue(XMigemoUI.findBarHidden);
	},

	tearDown : function() {
		commonTearDown();
	},

	'自動開始→タイムアウトによる自動終了': function() {
		XMigemoUI.autoStartQuickFind = true;
		yield Do(assert_quickFind_autoStart('nihongo'));
		yield Do(assert_quickFind_timeout());
		yield Do(assert_find_start());
	},

	'自動開始→手動終了（BS）': function() {
		XMigemoUI.autoStartQuickFind = true;
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_autoStart(findTerm));
		yield Do(assert_quickFind_exitByBS(findTerm));
		yield Do(assert_find_start());
	},

	'自動開始→手動終了（ESC）': function() {
		XMigemoUI.autoStartQuickFind = true;
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_autoStart(findTerm));
		yield Do(assert_quickFind_exitByESC());
		yield Do(assert_find_start());
	},

	'自動開始→手動終了（画面クリック）': function() {
		XMigemoUI.autoStartQuickFind = true;
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_autoStart(findTerm));
		yield Do(assert_quickFind_exitByClick());
		yield Do(assert_find_start());
	},

	'自動開始の時に手動開始を試みた場合': function() {
		XMigemoUI.autoStartQuickFind = true;
		yield Do(assert_quickFind_autoStart('/'));
	},

	'手動開始→タイムアウトによる自動終了': function() {
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_manualStart(findTerm));
		yield Do(assert_quickFind_timeout());
		yield Do(assert_find_start());
	},

	'手動開始→手動終了（BS）': function() {
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_manualStart(findTerm));
		yield Do(assert_quickFind_exitByBS(findTerm));
		yield Do(assert_find_start());
	},

	'手動開始→手動終了（ESC）': function() {
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_manualStart(findTerm));
		yield Do(assert_quickFind_exitByESC());
		yield Do(assert_find_start());
	},

	'手動開始→手動終了（画面クリック）': function() {
		var findTerm = 'nihongo';
		yield Do(assert_quickFind_manualStart(findTerm));
		yield Do(assert_quickFind_exitByClick());
		yield Do(assert_find_start());
	},

	'手動開始の時に自動開始を試みた場合': function() {
		var key = { charCode : 'n'.charCodeAt(0) };
		action.fireKeyEventOnElement(content.document.documentElement, key);
		yield wait;
		assert.isTrue(XMigemoUI.findBarHidden);
	}
};
