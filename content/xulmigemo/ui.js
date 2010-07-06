/* 
	This depends on:
		service.js
*/

var XMigemoFind;
 
var XMigemoUI = { 
	
/* constants */ 

	kFINDBAR_POSITION : '_moz-xmigemo-position',
	kTARGET           : '_moz-xmigemo-target',
	kLAST_HIGHLIGHT   : '_moz-xmigemo-last-highlight',
	kFOCUSED          : '_moz-xmigemo-focused',

	kDISABLE_IME    : '_moz-xmigemo-disable-ime',
	kINACTIVATE_IME    : '_moz-xmigemo-inactivate-ime',
	get IMEAttribute()
	{
		return this.isLinux ? this.kDISABLE_IME : this.kINACTIVATE_IME ;
	},

	isLinux : (navigator.platform.toLowerCase().indexOf('linux') > -1),

	kXHTMLNS : 'http://www.w3.org/1999/xhtml',

	nsITypeAheadFind : Components.interfaces.nsITypeAheadFind,
	nsIDOMNSEditableElement : Components.interfaces.nsIDOMNSEditableElement,
	
	get textUtils() 
	{
		if (!this._textUtils) {
			this._textUtils = Components
				.classes['@piro.sakura.ne.jp/xmigemo/text-utility;1']
				.getService(Components.interfaces.xmIXMigemoTextUtils);
		}
		return this._textUtils;
	},
	_textUtils : null,
  
/* internal status */ 
	
	FIND_MODE_NATIVE : Components.interfaces.xmIXMigemoFind.FIND_MODE_NATIVE, 
	FIND_MODE_MIGEMO : Components.interfaces.xmIXMigemoFind.FIND_MODE_MIGEMO,
	FIND_MODE_REGEXP : Components.interfaces.xmIXMigemoFind.FIND_MODE_REGEXP,

	forcedFindMode   : -1,
	lastFindMode     : -1,
	backupFindMode   : -1,

	isModeChanged : false,
	
	findModeVersion : 2, 
	findModeFrom1To2 : {
		'0' : Components.interfaces.xmIXMigemoFind.FIND_MODE_NATIVE,
		'1' : Components.interfaces.xmIXMigemoFind.FIND_MODE_MIGEMO,
		'2' : Components.interfaces.xmIXMigemoFind.FIND_MODE_REGEXP
	},
	upgradeFindModePrefs : function()
	{
		var modeVersion = XMigemoService.getPref('xulmigemo.findMode.version') || 1;
		if (modeVersion == this.findModeVersion) return;

		var table = 'findModeFrom'+modeVersion+'To'+this.findModeVersion;
		if (!(table in this)) return;

		table = this[table];
		'xulmigemo.findMode.default xulmigemo.findMode.always'
			.split(' ')
			.forEach(function(aPref) {
				var value = XMigemoService.getPref(aPref);
				if (value in table)
					XMigemoService.setPref(aPref, table[value]);
			}, this);

		XMigemoService.setPref('xulmigemo.findMode.version', this.findModeVersion);
	},
  
	autoStartQuickFind       : false, 
	autoExitQuickFindInherit : true,
	autoExitQuickFind        : true,
	timeout                  : 0,
	stopTimerWhileScrolling : true,
 
	autoStartRegExpFind      : false, 
 
	disableIMEOnQuickFindFor  : 7, 
	disableIMEOnNormalFindFor : 0,
 
	highlightCheckedAlways     : false, 
	highlightCheckedAlwaysMinLength : 2,
 
	caseSensitiveCheckedAlways : false, 
 
	_modeCirculation : 0, 
	get modeCirculation()
	{
		return this._modeCirculation;
	},
	set modeCirculation(val)
	{
		this._modeCirculation = val;
		this.modeCirculationTable = [];
		if (this.modeCirculation & this.FIND_MODE_NATIVE)
			this.modeCirculationTable.push(this.FIND_MODE_NATIVE);
		if (this.modeCirculation & this.FIND_MODE_REGEXP)
			this.modeCirculationTable.push(this.FIND_MODE_REGEXP);
		if (this.modeCirculation & this.FIND_MODE_MIGEMO)
			this.modeCirculationTable.push(this.FIND_MODE_MIGEMO);
		if (this.modeCirculation & this.CIRCULATE_MODE_EXIT)
			this.modeCirculationTable.push(this.CIRCULATE_MODE_EXIT);
		return val;
	},
	modeCirculationTable : [],
	CIRCULATE_MODE_NONE : 0,
	CIRCULATE_MODE_EXIT : 256,
 
	prefillWithSelection   : false, 
	workForAnyXMLDocuments : true,
 
	kLABELS_SHOW : 0, 
	kLABELS_AUTO : 1,
	kLABELS_HIDE : 2,
	buttonLabelsMode : 1,
 
	kCLOSEBUTTON_POSITION_LEFTMOST : 0, 
	kCLOSEBUTTON_POSITION_RIGHTMOST : 1,
	closeButtonPosition : 0,
	lastCloseButtonPosition : 0,
 
	kFINDBAR_POSITION_BELOW_CONTENT : 0, 
	kFINDBAR_POSITION_ABOVE_CONTENT : 1,
	kFINDBAR_POSITION_BELOW_TABS    : 2,
	findBarPositionAttrValues : [
		'belowcontent',
		'abovecontent',
		'belowtabbar'
	],
	findBarPosition : 0,

	get highlightSelectionOnly()
	{
		return this.highlightSelectionAvailable &&
				this._highlightUtilities.every(function(aUtility) {
					return !aUtility.requireDOMHighlight;
				});
	},
	registerHighlightUtility : function(aUtility)
	{
		if (this._highlightUtilities.indexOf(aUtility) < 0)
			this._highlightUtilities.push(aUtility);
	},
	unregisterHighlightUtility : function(aUtility)
	{
		var index = this._highlightUtilities.indexOf(aUtility);
		if (index > -1)
			this._highlightUtilities.splice(index, 1);
	},
	_highlightUtilities : [],

	get highlightSelectionAvailable()
	{
		return (
				this._highlightSelectionAvailable &&
				'SELECTION_FIND' in Components.interfaces.nsISelectionController
			);
	},
	set highlightSelectionAvailable(aValue)
	{
		this._highlightSelectionAvailable = aValue;
		return aValue;
	},
	_highlightSelectionAvailable : true,
  
/* elements */ 
	
	get browser() 
	{
		return document.getElementById('content') || // Firefox
			document.getElementById('messagepane') || // Thunderbird
			document.getElementById('help-content'); // Help
	},
	
	get activeBrowser() 
	{
		return ('SplitBrowser' in window && SplitBrowser.activeBrowser) || this.browser;
	},
  
	get target() 
	{
		return XMigemoFind.target;
	},
	
	get targetBox() 
	{
		var target = this.target;
		if (target.localName == 'tabbrowser')
			target = target.mPanelContainer;
		return target;
	},
  
	get findBar() 
	{
		if (!this._findBar) {
			this._findBar = document.getElementById('FindToolbar');
		}
		return this._findBar;
	},
	_findBar : null,
	
	get findBarItems() 
	{
		var node = this.closeButton;
		var items = [];
		do {
			items.push(node);
			node = node.nextSibling;
		}
		while (node);
		return items;
	},
 
	get closeButton() 
	{
		if (this._closeButton === void(0)) {
			this._closeButton = document.getElementById('find-closebutton');
			if (!this._closeButton && this.findBar) {
				this._closeButton = this.findBar.getElement('find-closebutton');
			}
		}
		return this._closeButton;
	},
//	_closeButton : null,
 
	get label() 
	{
		if (this._label === void(0)) {
			this._label = document.getElementById('find-label');
			if (!this._label && this.findBar) {
				this._label = this.findBar.getElement('find-label');
			}
		}
		return this._label;
	},
//	_label : null,
 
	get field() 
	{
		if (this._field === void(0)) {
			this._field = document.getElementById('find-field');
			if (!this._field && this.findBar) {
				this._field = this.findBar.getElement('findbar-textbox');
			}
		}
		return this._field;
	},
//	_field : null,
 
	get findNextButton() 
	{
		if (this._findNextButton === void(0)) {
			this._findNextButton = document.getElementById('find-next');
			if (!this._findNextButton && this.findBar) {
				this._findNextButton = this.findBar.getElement('find-next');
			}
		}
		return this._findNextButton;
	},
//	_findNextButton : null,
 
	get findPreviousButton() 
	{
		if (this._findPreviousButton === void(0)) {
			this._findPreviousButton = document.getElementById('find-previous');
			if (!this._findPreviousButton && this.findBar) {
				this._findPreviousButton = this.findBar.getElement('find-previous');
			}
		}
		return this._findPreviousButton;
	},
//	_findPreviousButton : null,
 
	get caseSensitiveCheck() 
	{
		if (this._caseSensitiveCheck === void(0)) {
			this._caseSensitiveCheck = document.getElementById('find-case-sensitive');
			if (!this._caseSensitiveCheck && this.findBar) {
				this._caseSensitiveCheck = this.findBar.getElement('find-case-sensitive');
			}
		}
		return this._caseSensitiveCheck;
	},
//	_caseSensitiveCheck : null,
 
	get highlightCheck() 
	{
		if (this._highlightCheck === void(0)) {
			this._highlightCheck = document.getElementById('highlight');
			if (!this._highlightCheck && this.findBar) {
				this._highlightCheck = this.findBar.getElement('highlight');
			}
		}
		return this._highlightCheck;
	},
//	_highlightCheck : null,
  
	get findMigemoBar() 
	{
		if (!this._findMigemoBar) {
			this._findMigemoBar = document.getElementById('XMigemoFindToolbar');
		}
		return this._findMigemoBar;
	},
	_findMigemoBar : null,
	
	get findModeSelectorBox() 
	{
		if (!this._findModeSelectorBox) {
			this._findModeSelectorBox = document.getElementById('find-migemo-mode-box');
		}
		return this._findModeSelectorBox;
	},
	_findModeSelectorBox : null,
 
	get findModeSelector() 
	{
		if (!this._findModeSelector) {
			this._findModeSelector = document.getElementById('find-mode-selector');
		}
		return this._findModeSelector;
	},
	_findModeSelector : null,
 
	get timeoutIndicator() 
	{
		if (!this._timeoutIndicator) {
			this._timeoutIndicator = document.getElementById('migemo-timeout-indicator');
		}
		return this._timeoutIndicator;
	},
	_timeoutIndicator : null,
   
/* status */ 
	
	get isQuickFind() 
	{
		return XMigemoFind.isQuickFind;
	},
	set isQuickFind(val)
	{
		XMigemoFind.isQuickFind = val;
		return XMigemoFind.isQuickFind;
	},
 
	get findMode() 
	{
		return parseInt(this.findModeSelector.value || this.FIND_MODE_NATIVE);
	},
	set findMode(val)
	{
		var mode = parseInt(val);
		switch (mode)
		{
			case this.FIND_MODE_MIGEMO:
			case this.FIND_MODE_REGEXP:
			case this.FIND_MODE_NATIVE:
				this.findModeSelector.value = mode;
				break;

			default:
				this.findModeSelector.value = mode = this.FIND_MODE_NATIVE;
				break;
		}
		this.onChangeMode();
		return mode;
	},
 
	get findTerm() 
	{
		try {
			return this.textUtils.trim(this.field.value);
		}
		catch(e) {
		}
		return '';
	},
	set findTerm(val)
	{
		try {
			if (this.field)
				this.field.value = val;
		}
		catch(e) {
		}
		return this.findTerm;
	},
 
	get lastFoundTerm() 
	{
		return ((this.lastFindMode == this.FIND_MODE_NATIVE) ? this.findTerm : XMigemoFind.lastFoundWord ) || '';
	},
 
	get lastFoundRange() 
	{
		return this.getLastFoundRangeIn(this.activeBrowser.contentWindow);
	},
	getLastFoundRangeIn : function(aFrame)
	{
		var range = this.textUtils.getFoundRange(aFrame);
		if (!range) {
			var sel = aFrame.getSelection();
			if (
				sel &&
				sel.rangeCount &&
				(!this.caseSensitiveCheck.disabled && this.caseSensitiveCheck.checked ?
					sel.toString() == XMigemoUI.lastFoundTerm :
					sel.toString().toLowerCase() == XMigemoUI.lastFoundTerm.toLowerCase()
				)
				)
				range = sel.getRangeAt(0);
		}
		if (range) return range;

		Array.slice(aFrame.frames)
			.some(function(aFrame) {
				range = this.getLastFoundRangeIn(aFrame);
				return range;
			}, this);
		return range;
	},
 
	get hidden() 
	{
		return (this.findBar.getAttribute('collapsed') == 'true' ||
				this.findBar.getAttribute('hidden') == 'true');
	},
	set hidden(aValue)
	{
		if (aValue)
			this.closeFindBar();
		else
			this.openFindBar();
		return aValue;
	},
 
	get focused() 
	{
		return this.getFindFieldFromContent(document.commandDispatcher.focusedElement);
	},
	set focused(aValue)
	{
		if (aValue) this.field.focus();
		return aValue;
	},
	
	getFindFieldFromContent : function(aNode) 
	{
		try {
			var xpathResult = document.evaluate(
					'ancestor-or-self::*[local-name()="textbox"]',
					aNode,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
			if (xpathResult.singleNodeValue == this.field)
				return xpathResult.singleNodeValue;
		}
		catch(e) {
		}
		return null;
	},
  
	get shouldHighlightAll() 
	{
		var term = this.findTerm;
		if (!this.highlightCheckedAlways)
			return term.length ? true : false ;

		var minLength = Math.max(1, this.highlightCheckedAlwaysMinLength);
		var termLength = term.length;
		if (termLength) {
			var flags = 'gm';
			if (this.findMode == this.FIND_MODE_MIGEMO ||
				!this.caseSensitiveCheck.checked)
				flags += 'i';
			var regexp;
			switch (this.findMode)
			{
				case this.FIND_MODE_REGEXP:
					regexp = new RegExp(this.textUtils.extractRegExpSource(term), flags);
					break;
				case this.FIND_MODE_MIGEMO:
					regexp = migemo.getRegExp(term, flags);
					break
				default:
					regexp = new RegExp(this.textUtils.sanitize(term), flags);
					break;
			}
			termLength = Math.max.apply(
				null,
				this.getMatchedTerms(
					regexp,
					this.activeBrowser.contentWindow
				).map(function(aItem) {
					return (aItem || '').length;
				})
				.concat(0) // to prevent "-Infinity" error
			);
		}

		return minLength <= termLength;
	},
	getMatchedTerms : function(aRegExp, aWindow)
	{
		var results = [];
		var frames = aWindow.frames;
		for (var i = 0, maxi = frames.length; i < maxi; i++)
		{
			results = results.concat(this.getMatchedTerms(aRegExp, frames[i]));
		}

		var doc = aWindow.document;
		var range = doc.createRange();
		range.selectNodeContents(doc.documentElement);

		var arrTerms = this.textUtils.range2Text(range).match(aRegExp);
		if (arrTerms)
			results = results.concat(arrTerms);

		return results;
	},
 
	get isScrolling() 
	{
		return this._isScrolling;
	},
	set isScrolling(aValue)
	{
		this._isScrolling = aValue;

		if (aValue)
			this.clearTimer();
		else if (this.isActive && this.stopTimerWhileScrolling)
			this.restartTimer();

		return aValue;
	},
	_isScrolling : false,
 
	get shouldCaseSensitive() 
	{
		return this.findMode != this.FIND_MODE_MIGEMO && this.caseSensitiveCheck.checked;
	},
  
/* utilities */ 
	
	getEditableNodes : function(aDocument) 
	{
		var expression = [
					'descendant::*[',
						'local-name()="TEXTAREA" or local-name()="textarea" or ',
						'((local-name()="INPUT" or local-name()="input") and contains("TEXT text FILE file", @type))',
					']'
				].join('');
		return aDocument.evaluate(
				expression,
				aDocument,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
	},
 
	clearSelectionInEditable : function(aFrame) 
	{
		try {
			var xpathResult = this.getEditableNodes(aFrame.document);
			var selCon, selection;
			for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
			{
				selCon = xpathResult.snapshotItem(i)
					.QueryInterface(this.nsIDOMNSEditableElement)
					.editor
					.selectionController;
				if (selCon.getDisplaySelection() == selCon.SELECTION_ON &&
					(selection = selCon.getSelection(selCon.SELECTION_NORMAL)) &&
					selection.rangeCount)
					selection.removeAllRanges();
			}
		}
		catch(e) {
		}
		Array.slice(aFrame.frames)
			.some(function(aFrame) {
				this.clearSelectionInEditable(aFrame);
			}, this);
	},
 
	disableFindFieldIME : function() 
	{
		if (!('imeMode' in this.field.style)) return;

		this.field.inputField.setAttribute(this.IMEAttribute, true);
		window.setTimeout(function(aSelf) {
			aSelf.field.inputField.removeAttribute(aSelf.IMEAttribute);
		}, 100, this);
	},
 
	disableFindFieldIMEForCurrentMode : function(aQuickFind) 
	{
		if (aQuickFind ?
				(this.disableIMEOnQuickFindFor & this.findMode) :
				(this.disableIMEOnNormalFindFor & this.findMode)
			)
			this.disableFindFieldIME();
	},
 
	getDocumentBody : function(aDocument) 
	{
		if (aDocument instanceof HTMLDocument)
			return aDocument.body;

		try {
			var xpathResult = aDocument.evaluate(
					'descendant::*[contains(" BODY body ", concat(" ", local-name(), " "))]',
					aDocument,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
			return xpathResult.singleNodeValue;
		}
		catch(e) {
		}
		return null;
	},
 
	clearFocusRing : function() 
	{
		this.doProcessForAllFrames(function(aFrame) {
			var nodes = aFrame.document.evaluate(
					'/descendant::*[@'+this.kFOCUSED+'="true"]',
					aFrame.document,
					null,
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			for (var i = nodes.snapshotLength-1; i > -1; i--)
			{
				nodes.snapshotItem(i).removeAttribute(this.kFOCUSED);
			}
		}, this);
	},
	
	doProcessForAllFrames : function(aProcess, aScope, aBrowserOrFrame) 
	{
		var b = aBrowserOrFrame || this.activeBrowser;
		var frames;
		if (b instanceof Ci.nsIDOMWindow) {
			frames = [b];
		}
		else if (b.localName == 'tabbrowser') {
			frames = Array.slice(b.mTabContainer.childNodes)
					.map(function(aTab) {
						return aTab.linkedBrowser.contentWindow;
					});
		}
		else {
			frames = [b.contentWindow];
		}
		frames.forEach(function(aFrame) {
			if (!aFrame) return;
			if (aFrame.frames && aFrame.frames.length) {
				Array.slice(aFrame.frames).forEach(arguments.callee, this);
			}
			aProcess.call(aScope || this, aFrame);
		}, this);
	},
  
	fireFindToolbarUpdateRequestEvent : function(aTarget) 
	{
		var event = document.createEvent('UIEvents');
		event.initUIEvent('XMigemoFindBarUpdateRequest', true, true, window, 0);
		(aTarget || document).dispatchEvent(event);
	},
  
/* preferences observer */ 
	
	domain  : 'xulmigemo', 
 
	preferences : <![CDATA[ 
		xulmigemo.autostart
		xulmigemo.autostart.regExpFind
		xulmigemo.enableautoexit.inherit
		xulmigemo.enableautoexit.nokeyword
		xulmigemo.checked_by_default.highlight.always
		xulmigemo.checked_by_default.highlight.always.minLength
		xulmigemo.checked_by_default.caseSensitive
		xulmigemo.findMode.always
		xulmigemo.enabletimeout
		xulmigemo.enabletimeout.indicator
		xulmigemo.timeout
		xulmigemo.timeout.stopWhileScrolling
		xulmigemo.override_findtoolbar
		xulmigemo.shortcut.findForward
		xulmigemo.shortcut.findBackward
		xulmigemo.shortcut.manualStart
		xulmigemo.shortcut.manualStart2
		xulmigemo.shortcut.manualStartLinksOnly
		xulmigemo.shortcut.manualStartLinksOnly2
		xulmigemo.shortcut.goDicManager
		xulmigemo.shortcut.manualExit
		xulmigemo.shortcut.modeCirculation
		xulmigemo.appearance.buttonLabelsMode
		xulmigemo.appearance.indicator.height
		xulmigemo.appearance.closeButtonPosition
		xulmigemo.disableIME.quickFindFor
		xulmigemo.disableIME.normalFindFor
		xulmigemo.find_delay
		xulmigemo.ignore_find_links_only_behavior
		xulmigemo.prefillwithselection
		xulmigemo.work_for_any_xml_document
	]]>.toString(),
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = XMigemoService.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'xulmigemo.autostart':
				this.autoStartQuickFind = value;
				return;

			case 'xulmigemo.enableautoexit.inherit':
				this.autoExitQuickFindInherit = value;
				return;

			case 'xulmigemo.enableautoexit.nokeyword':
				this.autoExitQuickFind = value;
				return;

			case 'xulmigemo.autostart.regExpFind':
				this.autoStartRegExpFind = value;
				return;

			case 'xulmigemo.checked_by_default.highlight.always':
				this.highlightCheckedAlways = value;
				return;

			case 'xulmigemo.checked_by_default.highlight.always.minLength':
				this.highlightCheckedAlwaysMinLength = value;
				return;

			case 'xulmigemo.checked_by_default.caseSensitive.always':
				this.caseSensitiveCheckedAlways = value;
				return;

			case 'xulmigemo.findMode.always':
				this.forcedFindMode = value;
				return;

			case 'xulmigemo.enabletimeout':
				this.shouldTimeout = value;
				return;

			case 'xulmigemo.enabletimeout.indicator':
				this.shouldIndicateTimeout = value;
				return;

			case 'xulmigemo.timeout':
				this.timeout = value;
				if (this.timeout === null)
					this.timeout = value;
				return;

			case 'xulmigemo.timeout.stopWhileScrolling':
				this.stopTimerWhileScrolling = value;
				return;

			case 'xulmigemo.shortcut.findForward':
				this.findForwardKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-findForward', this.findForwardKey);
				return;

			case 'xulmigemo.shortcut.findBackward':
				this.findBackwardKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-findBackward', this.findBackwardKey);
				return;

			case 'xulmigemo.shortcut.manualStart':
				this.manualStartKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-manualStart', this.manualStartKey);
				return;

			case 'xulmigemo.shortcut.manualStart2':
				this.manualStartKey2 = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-manualStart2', this.manualStartKey2);
				return;

			case 'xulmigemo.shortcut.manualStartLinksOnly':
				this.manualStartLinksOnlyKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-manualStartLinksOnly', this.manualStartLinksOnlyKey);
				return;

			case 'xulmigemo.shortcut.manualStartLinksOnly2':
				this.manualStartLinksOnlyKey2 = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-manualStartLinksOnly2', this.manualStartLinksOnlyKey2);
				return;

			case 'xulmigemo.shortcut.manualExit':
				this.manualExitKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-manualExit', this.manualExitKey);
				return;

			case 'xulmigemo.shortcut.goDicManager':
				this.goDicManagerKey = XMigemoService.parseShortcut(value);
				XMigemoService.updateKey('xmigemo-shortcut-goDicManager', this.goDicManagerKey);
				return;

			case 'xulmigemo.shortcut.modeCirculation':
				this.modeCirculation = value;
				return;

			case 'xulmigemo.appearance.buttonLabelsMode':
				this.buttonLabelsMode = value;
				if (value == this.kLABELS_AUTO)
					this.onChangeFindBarSize();
				else
					this.showHideLabels(value != this.kLABELS_HIDE);
				return;

			case 'xulmigemo.appearance.indicator.height':
				this.updateIndicatorHeight(value);
				return;

			case 'xulmigemo.appearance.closeButtonPosition':
				this.closeButtonPosition = value;
				this.findBarInitialShown = false;
				return;

			case 'xulmigemo.disableIME.quickFindFor':
				this.disableIMEOnQuickFindFor = value;
				return;

			case 'xulmigemo.disableIME.normalFindFor':
				this.disableIMEOnNormalFindFor = value;
				return;

			case 'xulmigemo.find_delay':
				this.delayedFindDelay = value;
				return;

			case 'xulmigemo.ignore_find_links_only_behavior':
				this.shouldIgnoreFindLinksOnlyBehavior = value;
				return;

			case 'xulmigemo.prefillwithselection':
				this.prefillWithSelection = value;
				return;

			case 'xulmigemo.prefillwithselection':
				this.workForAnyXMLDocuments = value;
				return;
		}
	},
  
	handleEvent : function(aEvent) /* DOMEventListener */ 
	{
		switch (aEvent.type)
		{
			case 'input':
				this.onInput(aEvent);
				return;

			case 'keypress':
				this.onKeyPress(aEvent, this.getFindFieldFromContent(aEvent.originalTarget));
				return;

			case 'XMigemoFindProgress':
				this.onXMigemoFindProgress(aEvent);
				return;

			case 'XMigemoFindAgain':
				if (!this.isActive &&
					this.lastFindMode == this.FIND_MODE_NATIVE &&
					this.highlightCheck.checked) {
					window.setTimeout(function(aSelf) {
						aSelf.clearSelectionInEditable(aSelf.activeBrowser.contentWindow);
					}, 0, this);
				}
				return;

			case 'XMigemoFindBarOpen':
				this.startListen();
				this.onFindBarOpen(aEvent);
				return;

			case 'XMigemoFindBarClose':
				this.stopListen();
				this.highlightCheck.checked = false;
				return;

			case 'blur':
				this.onBlur(aEvent);
				return;

			case 'DOMContentLoaded':
				this.overrideExtensionsPreInit();
				window.removeEventListener('DOMContentLoaded', this, false);
				return;

			case 'load':
				this.init();
				return;

			case 'unload':
				this.stopListen();
				this.destroy();
				return;

			case 'mousedown':
				this.onMouseDown(aEvent);
				return;

			case 'mouseup':
				this.onMouseUp(aEvent);
				return;

			case 'scroll':
				this.onScroll(aEvent);
				return;

			case 'resize':
			case 'TreeStyleTabAutoHideStateChange':
			case 'XMigemoFindBarUpdateRequest':
				if (this.updatingFindBar) return;
				this.updatingFindBar = true;
				this.updateFloatingFindBarAppearance(aEvent);
				this.onChangeFindBarSize(aEvent);
				window.setTimeout(function(aSelf) {
					aSelf.updatingFindBar = false;
				}, 100, this);
				return;

			case 'SubBrowserContentExpanded':
				if (!this.hidden) return;
			case 'SubBrowserAdded':
			case 'SubBrowserRemoved':
			case 'SubBrowserContentCollapsed':
				if (this.findBarPosition != this.kFINDBAR_POSITION_BELOW_TABS)
					return;
				gFindBar.close();
				window.setTimeout('gFindBar.open();', 100);
				return;

			case 'SubBrowserFocusMoved':
				XMigemoFind.target = this.activeBrowser;
				this.findBar.setAttribute(this.kTARGET, this.activeBrowser.id || 'subbrowser');
				if (this.findBarPosition != this.kFINDBAR_POSITION_BELOW_TABS)
					return;
				gFindBar.close();
				window.setTimeout('gFindBar.open();', 100);
				return;

			default:
		}
	},
	
	startListen : function() 
	{
		if (this.listening) return;
		this.listening = true;

		window.addEventListener('resize', this, false);
		window.addEventListener('XMigemoFindBarUpdateRequest', this, false);

		var target = document.getElementById('appcontent') || this.browser;
		if (target) {
			target.addEventListener('mousedown', this, true);
			target.addEventListener('mouseup', this, true);
			target.addEventListener('scroll', this, true);
		}

		if ('SplitBrowser' in window) {
			var root = document.documentElement;
			root.addEventListener('SubBrowserAdded', this, false);
			root.addEventListener('SubBrowserRemoved', this, false);
			root.addEventListener('SubBrowserContentCollapsed', this, false);
			root.addEventListener('SubBrowserContentExpanded', this, false);
			root.addEventListener('SubBrowserFocusMoved', this, false);
		}

		if ('TreeStyleTabService' in window)
			document.addEventListener('TreeStyleTabAutoHideStateChange', this, false);
	},
 
	stopListen : function() 
	{
		if (!this.listening) return;
		this.listening = false;

		window.removeEventListener('resize', this, false);
		window.removeEventListener('XMigemoFindBarUpdateRequest', this, false);

		var target = document.getElementById('appcontent') || this.browser;
		if (target) {
			target.removeEventListener('mousedown', this, true);
			target.removeEventListener('mouseup', this, true);
			target.removeEventListener('scroll', this, true);
		}

		if ('SplitBrowser' in window) {
			var root = document.documentElement;
			root.removeEventListener('SubBrowserAdded', this, false);
			root.removeEventListener('SubBrowserRemoved', this, false);
			root.removeEventListener('SubBrowserContentCollapsed', this, false);
			root.removeEventListener('SubBrowserContentExpanded', this, false);
			root.removeEventListener('SubBrowserFocusMoved', this, false);
		}

		if ('TreeStyleTabService' in window)
			document.removeEventListener('TreeStyleTabAutoHideStateChange', this, false);
	},
 
	onKeyPress : function(aEvent, aFromFindField) 
	{
		if (
			this.processFunctionalKeyEvent(aEvent, aFromFindField) || // XUL/Migemoの終了その他のチェック
			this.processFunctionalShortcuts(aEvent, aFromFindField) ||
			this.processKeyEvent(aEvent, aFromFindField)
			)
			return;
	},
	
	processFunctionalShortcuts : function(aEvent, aFromFindField) 
	{
		if (
			!aFromFindField &&
			XMigemoService.isEventFiredInInputField(aEvent) &&
			!(
				aEvent.charCode == 0 ||
				aEvent.altKey ||
				aEvent.ctrlKey ||
				aEvent.metaKey
			)
			)
			return false;

		if (aFromFindField && this.isActive && !this.isQuickFind)
			return false;

		var shouldGoDicManager   = XMigemoService.checkShortcutForKeyEvent(this.goDicManagerKey, aEvent);
		var isForwardKey         = XMigemoService.checkShortcutForKeyEvent(this.findForwardKey, aEvent);
		var isBackwardKey        = XMigemoService.checkShortcutForKeyEvent(this.findBackwardKey, aEvent);
		var isStartKey           = XMigemoService.checkShortcutForKeyEvent(this.manualStartKey, aEvent);
		var isStartKey2          = XMigemoService.checkShortcutForKeyEvent(this.manualStartKey2, aEvent);
		var isStartKeyLinksOnly  = XMigemoService.checkShortcutForKeyEvent(this.manualStartLinksOnlyKey, aEvent);
		var isStartKeyLinksOnly2 = XMigemoService.checkShortcutForKeyEvent(this.manualStartLinksOnlyKey2, aEvent);
		var isExitKey            = XMigemoService.checkShortcutForKeyEvent(this.manualExitKey, aEvent);

		if (shouldGoDicManager) {
			XMigemoService.goDicManager();
			aEvent.preventDefault();
			return true;
		}

		if (!XMigemoService.isEventFiredInFindableDocument(aEvent))
			return false;

		if (isForwardKey || isBackwardKey) {
			aEvent.preventDefault();
			if (isForwardKey)
				this.commandForward(aEvent);
			else
				this.commandBackward(aEvent);
			return true;
		}

		if (
			!this.isActive &&
			(
				(!this.autoStartQuickFind && !aFromFindField) ||
				aEvent.charCode == 0 ||
				aEvent.altKey ||
				aEvent.ctrlKey ||
				aEvent.metaKey
			) &&
			(
				isStartKey ||
				isStartKey2 ||
				isStartKeyLinksOnly ||
				isStartKeyLinksOnly2
			)
			) {
			this.commandStart(aEvent, isStartKeyLinksOnly || isStartKeyLinksOnly2);
			aEvent.preventDefault();
			return true;
		}


		if (isExitKey) {
			aEvent.preventDefault();
			this.commandExit(aEvent);
			return true;
		}

		return false;
	},
 
	processFunctionalKeyEvent : function(aEvent, aFromFindField) 
	{
		if (!this.isActive || !this.isQuickFind) return false;

		switch (aEvent.keyCode)
		{
			case Components.interfaces.nsIDOMKeyEvent.DOM_VK_BACK_SPACE:
				if (XMigemoFind.lastKeyword.length == 0) {
					this.cancel();
					if (aFromFindField) {
						aEvent.stopPropagation();
						aEvent.preventDefault();
					}
					return true;
				}
				else if (XMigemoFind.lastKeyword.length == 1) {
					if (!aFromFindField)
						aEvent.preventDefault();
				}
				if (!aFromFindField)
					XMigemoFind.removeKeyword(1);
				this.updateStatus(XMigemoFind.lastKeyword);
				if (
					XMigemoFind.lastKeyword == '' &&
					(this.autoExitQuickFindInherit ? this.autoStartQuickFind : this.autoExitQuickFind )
					) {
					this.cancel();
				}
				else {
					if (!aFromFindField)
						aEvent.preventDefault();
					this.delayedFind();
					this.restartTimer();
				}
				return true;

			case Components.interfaces.nsIDOMKeyEvent.DOM_VK_ENTER:
			case Components.interfaces.nsIDOMKeyEvent.DOM_VK_RETURN:
				if (aFromFindField) {
					aEvent.stopPropagation();
					aEvent.preventDefault();
					if (!this.dispatchKeyEventForLink(aEvent, this.activeBrowser.contentWindow)) {
						this.restartTimer();
						return true;
					}
				}
				this.cancel();
				this.clearTimer(); // ここでタイマーを殺さないといじられてしまう
				return true;

			default:
				if (aFromFindField) {
					this.restartTimer();
					return true;
				}
				this.enableFindButtons(XMigemoFind.lastKeyword);
				return false;
		}
	},
	dispatchKeyEventForLink : function(aEvent, aFrame)
	{
		if (
			aFrame.frames &&
			Array.slice(aFrame.frames).some(function(aFrame) {
				return this.dispatchKeyEventForLink(aEvent, aFrame);
			}, this)
			)
			return true;

		var selection = aFrame.getSelection();
		if (selection && selection.rangeCount) {
			var range = selection.getRangeAt(0);
			var foundLink = XMigemoFind.getParentLinkFromRange(range);
			if (foundLink) {
				var event = aFrame.document.createEvent('KeyEvents');
				event.initKeyEvent(
					aEvent.type,
					aEvent.bubbles,
					aEvent.cancelable,
					aEvent.view,
					aEvent.ctrlKey,
					aEvent.altKey,
					aEvent.shiftKey,
					aEvent.metaKey,
					aEvent.keyCode,
					aEvent.charCode
				);
				foundLink.dispatchEvent(event);
				return true;
			}
		}
		return false;
	},
 
	processKeyEvent : function(aEvent, aFromFindField) 
	{
		if (
			aFromFindField ||
			(XMigemoService.isEventFiredInInputField(aEvent) && !this.isActive) ||
			!XMigemoService.isEventFiredInFindableDocument(aEvent)
			)
			return false;

		if (this.isActive) {
			if (
				aEvent.charCode != 0 &&
				!aEvent.ctrlKey &&
				!aEvent.altKey &&
				!aEvent.metaKey
				) { //普通。フックする。
				XMigemoFind.appendKeyword(String.fromCharCode(aEvent.charCode));
				this.updateStatus(XMigemoFind.lastKeyword);
				this.field.focus();
				aEvent.preventDefault();
				this.delayedFind();
				this.restartTimer();
				return true;
			}
		}
		else if (this.autoStartQuickFind) {
			if (aEvent.charCode == 32) { // Space
				return true;
			}
			else if (
				aEvent.charCode != 0 &&
				!aEvent.ctrlKey &&
				!aEvent.metaKey &&
				!aEvent.altKey
				) {
				this.disableFindFieldIME();
				XMigemoFind.clear(false);
				XMigemoFind.isLinksOnly = false;
				this.start();
				XMigemoFind.appendKeyword(String.fromCharCode(aEvent.charCode));
				this.updateStatus(XMigemoFind.lastKeyword);
				this.field.focus();
				aEvent.preventDefault();
				this.delayedFind();
				this.restartTimer();
				return true;
			}
		}
	},
	delayedFind : function()
	{
		if (this.delayedFindTimer) {
			window.clearTimeout(this.delayedFindTimer);
			this.delayedFindTimer = null;
		}
		this.delayedFindTimer = window.setTimeout(this.delayedFindCallback, this.delayedFindDelay);
	},
	delayedFindCallback : function()
	{
		XMigemoUI.find();
		XMigemoUI.enableFindButtons(XMigemoFind.lastKeyword);
		XMigemoUI.delayedFindTimer = null;
	},
	delayedFindTimer : null,
	delayedFindDelay : 0,
  
	onMouseDown : function(aEvent) 
	{
		if (!XMigemoService.isEventFiredOnScrollBar(aEvent) ||
			!this.isActive ||
			!this.stopTimerWhileScrolling)
			return;
		this.isScrolling = true;
	},
 
	onMouseUp : function(aEvent) 
	{
		if (this.isScrolling) {
			this.isScrolling = false;
			return;
		}

		if (!this.isQuickFind) {
			this.isActive = false;
			return;
		}

		this.cancel();
		this.clearTimer();//ここでタイマーを殺さないといじられてしまう。タイマー怖い。
	},
 
	onScroll : function() 
	{
		if (!this.isActive ||
			!this.stopTimerWhileScrolling ||
			this.isScrolling)
			return;
		this.restartTimer();
	},
 
	onXMigemoFindProgress : function(aEvent) 
	{
		var statusRes = (
				 XMigemoFind.isLinksOnly ?
				 	aEvent.resultFlag & XMigemoFind.FOUND_IN_LINK :
					aEvent.resultFlag & XMigemoFind.FOUND
			) ?
				this.nsITypeAheadFind.FIND_FOUND :
			(aEvent.resultFlag & XMigemoFind.WRAPPED) ?
				this.nsITypeAheadFind.FIND_WRAPPED :
				this.nsITypeAheadFind.FIND_NOTFOUND;

		var found = (statusRes == this.nsITypeAheadFind.FIND_FOUND || statusRes == this.nsITypeAheadFind.FIND_WRAPPED);
		gFindBar._enableFindButtons(this.findTerm);
		if (this.lastHighlightedKeyword != aEvent.findTerm) {
			this.lastHighlightedKeyword = aEvent.findTerm;
			if (found && this.highlightCheck.checked)
				gFindBar.setHighlightTimeout();
		}

		if (this.isQuickFind) {
			this.clearFocusRing();
			var link = XMigemoFind.getParentLinkFromRange(this.lastFoundRange);
			if (link) link.setAttribute(this.kFOCUSED, true);
		}

		gFindBar._updateStatusUI(statusRes, !(aEvent.findFlag & XMigemoFind.FIND_BACK));
	},
	lastHighlightedKeyword : null,
 
	onInput : function(aEvent) 
	{
		XMigemoFind.replaceKeyword(aEvent.target.value);

		if (this.autoStartRegExpFind && !this.isQuickFind) {
			var isRegExp = this.textUtils.isRegExp(aEvent.target.value);
			if (this.findMode != this.FIND_MODE_REGEXP &&
				isRegExp) {
				this.backupFindMode = this.findMode;
				this.findMode = this.FIND_MODE_REGEXP;
			}
			else if (this.findMode == this.FIND_MODE_REGEXP &&
					!isRegExp &&
					this.backupFindMode > -1) {
				this.findMode = this.backupFindMode;
				this.backupFindMode = -1;
			}
		}

		if (this.findMode != this.FIND_MODE_NATIVE) {
			aEvent.stopPropagation();
			aEvent.preventDefault();
			this.start(true);
			this.delayedFind();
		}
		else {
			this.lastFindMode = this.FIND_MODE_NATIVE;
		}
	},
 
	onBlur : function() 
	{
		if (this.isQuickFind) {
			this.cancel();
		}
	},
 
	onChangeFindBarSize : function(aEvent) 
	{
		var shouldUpdatePosition = false;
		if (this.findBarPosition == this.kFINDBAR_POSITION_BELOW_TABS &&
			this.lastTargetBox) {
			this.setFloatingFindBarWidth(this.lastTargetBox.boxObject.width, aEvent);
			shouldUpdatePosition = true;
		}
		if (this.buttonLabelsMode == this.kLABELS_AUTO) {
			this.showHideLabels(true);
			var box = this.caseSensitiveCheck.boxObject;
			if (box.x + box.width > this.findModeSelector.boxObject.x - 25) {
				this.showHideLabels(false);
				shouldUpdatePosition = true;
			}
			else {
				this.showHideLabels(true);
			}
		}
		this.updateModeSelectorPosition(shouldUpdatePosition);
	},
 
	onChangeMode : function() 
	{
		this.clearTimer();
		var highlighted = this.highlightCheck.checked;
		if (highlighted) {
			gFindBar.toggleHighlight(false);
			this.clearHighlight(this.activeBrowser.contentDocument, true);
		}
		if (!this.hidden && !this.inCancelingProcess) {
			if (this.isQuickFind || this.findMode == this.FIND_MODE_NATIVE) {
				this.cancel(true);
			}
			else {
				this.start(true);
			}
		}
		this.lastFindMode = this.findMode;
		this.isModeChanged = true;
		this.disableFindFieldIMEForCurrentMode(this.isQuickFind);
		if (!this.inCancelingProcess &&
			!this.hidden) {
			this.field.focus();
		}
		if (highlighted) {
			gFindBar.toggleHighlight(true);
		}
	},
 
	// flip back to another find mode
	onClickMode : function(aEvent) 
	{
		if (!aEvent.target.selected) return;

		aEvent.stopPropagation();
		aEvent.preventDefault();

		window.setTimeout(function(aSelf, aValue) {
			aSelf.findMode = aValue == aSelf.FIND_MODE_NATIVE ?
				aSelf.FIND_MODE_MIGEMO :
				aSelf.FIND_MODE_NATIVE ;
		}, 0, this, aEvent.target.value);
	},
 
	onFindStartCommand : function() 
	{
		if (this.hidden || this.isQuickFind) return;

		if (!this.focused) return;

		window.setTimeout(function(aSelf) {
			aSelf.onFindStartCommandCallback();
		}, 0, this);
	},
	
	onFindStartCommandCallback : function() 
	{
		var nextMode = this.getModeCirculationNext();
		switch (nextMode)
		{
			case this.CIRCULATE_MODE_NONE:
				break;

			case this.CIRCULATE_MODE_EXIT:
				nextMode = this.getModeCirculationNext(nextMode);
				if (nextMode != this.CIRCULATE_MODE_EXIT) {
					this.findMode = nextMode;
				}
				gFindBar.close();
				break;

			default:
				this.findMode = nextMode;
				break;
		}
	},
	getModeCirculationNext : function(aCurrentMode)
	{
		if (!this.modeCirculationTable.length) {
			return this.CIRCULATE_MODE_NONE;
		}
		var modes = [
				this.FIND_MODE_NATIVE,
				this.FIND_MODE_REGEXP,
				this.FIND_MODE_MIGEMO,
				this.CIRCULATE_MODE_EXIT
			];
		var index = modes.indexOf(aCurrentMode || this.findMode);
		do {
			index = (index + 1) % (modes.length);	
		}
		while (this.modeCirculationTable.indexOf(modes[index]) < 0)
		return modes[index];
	},
  
	onFindBarOpen : function(aEvent) 
	{
		this.updateItemOrder();
		this.updateFindBarAppearance();
		this.updateModeSelectorPosition(true);
		if (this.lastWindowWidth != window.innerWidth) {
			this.onChangeFindBarSize();
			this.lastWindowWidth = window.innerWidth;
		}

		this.updateCaseSensitiveCheck();

		this.findBarInitialShow();

		if (this.prefillWithSelection)
			this.doPrefillWithSelection(aEvent.isQuickFind);

		this.disableFindFieldIMEForCurrentMode(aEvent.isQuickFind);
	},
	
	findBarInitialShow : function() 
	{
		if (this.findBarInitialShown) return;
		this.findBarInitialShown = true;
		if (this.findBarPosition == this.kFINDBAR_POSITION_BELOW_CONTENT &&
			this.closeButtonPosition == this.kCLOSEBUTTON_POSITION_LEFTMOST)
			return;
		window.setTimeout(function(aSelf) {
			var items = aSelf.findBarItems;
			items = items.sort(function(aA, aB) {
					return parseInt(aA.ordinal) - parseInt(aB.ordinal);
				}).filter(function(aItem) {
					return aItem.boxObject.x;
				});
			var wrongOrder = false;
			for (var i = 0, maxi = items.length-1; i < maxi; i++)
			{
				if (items[i].boxObject.x < items[i+1].boxObject.x)
					continue;
				wrongOrder = true;
				break;
			}
			if (!wrongOrder) return;

			aSelf.findBar.hidden = true;
			window.setTimeout(function(aSelf) {
				aSelf.findBar.hidden = false;
				window.setTimeout(function(aSelf) {
					aSelf.field.focus();
				}, 0, aSelf);
			}, 0, aSelf);
		}, 0, this);
	},
 
	doPrefillWithSelection : function(aShowMinimalUI) 
	{
		var win = document.commandDispatcher.focusedWindow;
		if (!win || win.top == window.top) win = window.content;
		var sel = this.textUtils.trim(win && win.getSelection() ? win.getSelection().toString() : '' )
					.replace(/\n/g, '');
		if (!sel) return;

		if (this.isActive || this.findMode != this.FIND_MODE_NATIVE) {
			if (this.isQuickFind) return;
			this.findTerm = sel;
			if (
				XMigemoFind.lastKeyword == sel ||
				XMigemoFind.lastFoundWord == sel
				)
				return;
			this.findAgain(sel, this.findMode);
		}
		else {
			if (
				 aShowMinimalUI ||
				 this.findTerm == sel
				 )
				 return;
			this.findTerm = sel;
			this.findAgain(sel, this.FIND_MODE_NATIVE);
		}
	},
   
/* Migemo Find */ 
	
/* timer */ 
	
/* Cancel Timer */ 
	shouldTimeout : true,
	cancelTimer : null,
	
	startTimer : function() 
	{
		if (!this.isQuickFind) return;
		this.clearTimer();
		this.cancelTimer = window.setTimeout(this.timerCallback, this.timeout, this);
		this.updateTimeoutIndicator(this.timeout);
		window.setTimeout(function(aSelf) {
			aSelf.textUtils.setSelectionLook(aSelf.activeBrowser.contentDocument, true);
		}, 0, this);
	},
	
	timerCallback : function(aThis) 
	{
		XMigemoFind.shiftLastKeyword();
		aThis.cancel();
	},
  
	restartTimer : function() 
	{
		if (!this.isQuickFind) return;
		if (this.shouldTimeout)
			this.startTimer();
	},
 
	clearTimer : function() 
	{
		if (this.cancelTimer) {
			window.clearTimeout(this.cancelTimer);
			this.cancelTimer = null;
		}
		if (this.indicatorTimer) {
			window.clearTimeout(this.indicatorTimer);
			this.indicatorTimer = null;
		}
	},
  
/* Indicator Timer */ 
	indicatorTimer : null,
	indicatorStartTime : null,
	shouldIndicateTimeout : true,

	updateTimeoutIndicator : function(aTimeout, aCurrent, aThis)
	{
		aThis = aThis || this;
		if (!aThis.timeoutIndicator) return;

		if (aThis.indicatorTimer) {
			window.clearTimeout(aThis.indicatorTimer);
			aThis.indicatorTimer = null;
		}

		var value = 0;
		if (aTimeout > -1) {
			if (aCurrent === void(0)) {
				aThis.indicatorStartTime = (new Date()).getTime();
				aCurrent = aTimeout;
			}

			value = Math.min(100, parseInt((aCurrent / aTimeout) * 100));
		}

		if (value <= 0) {
			aThis.timeoutIndicator.removeAttribute('value');
			aThis.timeoutIndicator.setAttribute('hidden', true);
			if (aThis.indicatorStartTime)
				aThis.indicatorStartTime = null;
		}
		else if (aThis.shouldIndicateTimeout) {
			aThis.timeoutIndicator.setAttribute('value', value+'%');
			aThis.timeoutIndicator.removeAttribute('hidden');
			aThis.timeoutIndicator.style.right = (
				document.documentElement.boxObject.width
				- aThis.findBar.boxObject.x
				- aThis.findBar.boxObject.width
			)+'px';
			aThis.timeoutIndicator.style.bottom = (
				document.documentElement.boxObject.height
				- aThis.findBar.boxObject.y
				- aThis.findBar.boxObject.height
			)+'px';

			aCurrent = aTimeout - parseInt(((new Date()).getTime() - aThis.indicatorStartTime));

			aThis.indicatorTimer = window.setTimeout(arguments.callee, 50, aTimeout, aCurrent, aThis);
		}
	},
  
	start : function(aSilently) 
	{
		if (this.inStartingProcess) return;
		this.inStartingProcess = true;

		this.isActive = true;

		if (!aSilently) {
			if (!this.isQuickFind) {
				this.isQuickFind = true;
				this.backupFindMode = this.findMode;
				this.findMode = this.FIND_MODE_MIGEMO;
			}

			if (this.shouldTimeout)
				this.startTimer();
		}

		this.lastFindMode = this.findMode;

		if (this.hidden) {
			gFindBar.open();
		}
		else {
			this.updateFindUI();
			this.updateCaseSensitiveCheck();
		}

		if (this.findTerm != XMigemoFind.lastKeyword)
			this.findTerm = XMigemoFind.lastKeyword;

		this.inStartingProcess = false;
	},
	inStartingProcess : false,
 
	cancel : function(aSilently) 
	{
		if (this.inCancelingProcess || this.inStartingProcess) return;
		this.inCancelingProcess = true;

		this.isActive = false;

		if (!aSilently) XMigemoFind.clear(this.isQuickFind);

		if (!aSilently || this.isQuickFind)
			gFindBar.close();
		else
			this.updateCaseSensitiveCheck();

		if (this.isQuickFind) {
			this.findMode = this.backupFindMode;
			this.backupFindMode = -1;
			this.isQuickFind = false;
		}

		if (this.delayedFindTimer) {
			window.clearTimeout(this.delayedFindTimer);
			this.delayedFindTimer = null;
		}

		this.updateTimeoutIndicator(-1);
		this.clearTimer();

		this.inCancelingProcess = false;
	},
	inCancelingProcess : false,
 
	find : function() 
	{
		XMigemoFind.findMode = this.findMode;
		XMigemoFind.caseSensitive = this.shouldCaseSensitive;
		XMigemoFind.find(false, XMigemoFind.lastKeyword, false);
	},
 
	findAgain : function(aKeyword, aMode) 
	{
		if (aMode != this.FIND_MODE_NATIVE) {
			XMigemoFind.replaceKeyword(aKeyword);
			this.updateStatus(aKeyword);
			this.find();
		}
		else {
			var w = document.commandDispatcher.focusedWindow;
			var d = w.top.document == window.top.document ? _content.document : w.document ;
			if (d) {
				if (d.foundEditable) {
					d.foundEditable
						.QueryInterface(this.nsIDOMNSEditableElement)
						.editor.selection.removeAllRanges();
					d.foundEditable = null;
				}
				d.defaultView.getSelection().removeAllRanges();
			}
			gFindBar._find();
		}
	},
  
/* commands */ 
	
	commandStart : function(aEvent, aLinksOnly) 
	{
		if (this.disableIMEOnQuickFindFor)
			this.disableFindFieldIME();
		XMigemoFind.clear(false);
		XMigemoFind.isLinksOnly = aLinksOnly ? true : false ;
		this.start();
		this.field.focus();
	},
 
	commandExit : function(aEvent) 
	{
		this.cancel();
		this.clearTimer(); // ここでタイマーを殺さないといじられてしまう
		var win = document.commandDispatcher.focusedWindow;
		var doc = (win != window) ? win.document : this.activeBrowser.contentDocument;
		this.textUtils.setSelectionLook(doc, false);
	},
 
	commandForward : function(aEvent) 
	{
		XMigemoFind.findNext(false);
		if (this.cancelTimer)
			this.startTimer();
	},
 
	commandBackward : function(aEvent) 
	{
		XMigemoFind.findPrevious(false);
		if (this.cancelTimer)
			this.startTimer();
	},
  
/* UI */ 
	
	showHideLabels : function(aShow) 
	{
		var buttons = [
				this.findNextButton,
				this.findPreviousButton,
				this.caseSensitiveCheck,
				this.highlightCheck
			];
		var switchers = Array.slice(this.findModeSelector.childNodes);
		if (aShow) {
			buttons.forEach(function(aNode) {
				aNode.removeAttribute('tooltiptext');
				aNode.setAttribute('label', aNode.getAttribute('long-label'));
			});
			switchers.forEach(function(aNode) {
				aNode.setAttribute('label', aNode.getAttribute('long-label'));
			});
		}
		else {
			buttons.forEach(function(aNode) {
				aNode.setAttribute('tooltiptext', aNode.getAttribute('long-label'));
				aNode.setAttribute('label', aNode.getAttribute('short-label'));
			});
			switchers.forEach(function(aNode) {
				aNode.setAttribute('label', aNode.getAttribute('short-label'));
			});
		}
	},
 
	updateIndicatorHeight : function(aHeight) 
	{
		var node = this.timeoutIndicator;
		if (aHeight) {
			node.style.minHeight = aHeight+'px';
			node.style.maxHeight = aHeight+'px';
		}
		else {
			node.style.minHeight = 'none';
			node.style.maxHeight = 'auto';
		}
	},
 
	updateItemOrder : function(aPosition) 
	{
		if (this.closeButtonPosition == this.lastCloseButtonPosition) return;
		this.lastCloseButtonPosition = this.closeButtonPosition;

		var items = this.findBarItems;
		var closebox = items.shift();
		closebox.ordinal = (this.closeButtonPosition == this.kCLOSEBUTTON_POSITION_RIGHTMOST) ?
				(items.length + 2) * 100 :
				1 ;
		items.forEach(function(aItem, aIndex) {
			aItem.ordinal = (aIndex + 1) * 100;
		});
	},
 
	updateModeSelectorPosition : function(aForceUpdate) 
	{
		var box = this.findModeSelectorBox;
		var findBarBox = this.findBar.boxObject;
		var baseState = {
				height : findBarBox.height,
				width  : findBarBox.width,
				x      : findBarBox.x,
				y      : findBarBox.y
			}.toSource();
		if (!aForceUpdate && box.lastBaseState == baseState) return;
		box.removeAttribute('hidden');
		box.style.height = findBarBox.height+'px';
		box.style.right = (
				document.documentElement.boxObject.width
				- findBarBox.x
				- findBarBox.width
				+ (
					(this.closeButtonPosition == this.kCLOSEBUTTON_POSITION_RIGHTMOST) ?
						this.closeButton.boxObject.width + this.rightMostOffset :
						0
				)
			)+'px';
		box.style.top = (this.findBarPosition == this.kFINDBAR_POSITION_BELOW_CONTENT) ?
			'auto' :
			this.findBar.boxObject.y+'px' ;
		box.style.bottom = (this.findBarPosition == this.kFINDBAR_POSITION_BELOW_CONTENT) ?
			(
				document.documentElement.boxObject.height
				- findBarBox.y
				- findBarBox.height
			)+'px' :
			'auto' ;
		box.lastBaseState = baseState;
	},
	rightMostOffset : 5,
 
	updateFindBarPosition : function() 
	{
		this.findBarPosition = XMigemoService.getPref('xulmigemo.appearance.findBarPosition');
		if (this.findBarPosition < 0 || this.findBarPosition >= this.findBarPositionAttrValues.length)
			this.findBarPosition = this.kFINDBAR_POSITION_BELOW_CONTENT;

		if ('XMigemoMail' in window && this.findBarPosition == this.kFINDBAR_POSITION_BELOW_TABS)
			this.findBarPosition = this.kFINDBAR_POSITION_ABOVE_CONTENT;

		var bar = this.findBar;
		bar.setAttribute(this.kFINDBAR_POSITION, this.findBarPositionAttrValues[this.findBarPosition]);

		if (this.findBarPosition != this.kFINDBAR_POSITION_ABOVE_CONTENT) return;

		var contentArea = document.getElementById('browser') || // Firefox
					document.getElementById('messagepane'); // Thunderbird
		try {
			if ('gFindBar' in window &&
				'uninitFindBar' in gFindBar)
				gFindBar.uninitFindBar();
		}
		catch(e) {
		}
		contentArea.parentNode.insertBefore(bar, contentArea);
		try {
			if ('gFindBar' in window &&
				'initFindBar' in gFindBar)
				gFindBar.initFindBar();
		}
		catch(e) {
		}
	},
 
	updateFindBarAppearance : function() 
	{
		if (this.findBarPosition != this.kFINDBAR_POSITION_BELOW_TABS &&
			this.findBarPosition != this.kFINDBAR_POSITION_ABOVE_CONTENT)
			return;

		this.cleanUpOnFindBarHidden()

		var floating = (this.findBarPosition == this.kFINDBAR_POSITION_BELOW_TABS);
		if (floating) {
			this.updateFloatingFindBarAppearance();
			this.onChangeFindBarSize();
		}

		var height = this.findBar.boxObject.height;

		var target = this.target;
		var targetBox = this.targetBox;
		if (floating) targetBox.style.paddingTop = height+'px';
		target.contentWindow.scrollBy(0, height);

		this.lastTarget = target;
		this.lastTargetBox = targetBox;
		this.contentAreaYOffset = height;
	},
 
	cleanUpOnFindBarHidden : function() 
	{
		if (!this.lastTarget) return;
		switch (this.findBarPosition)
		{
			case this.kFINDBAR_POSITION_BELOW_TABS:
				this.lastTargetBox.style.paddingTop = 0;

			case this.kFINDBAR_POSITION_ABOVE_CONTENT:
				this.lastTarget.contentWindow.scrollBy(0, -this.contentAreaYOffset);
				this.lastTarget = null;
				this.lastTargetBox = null;
				this.contentAreaYOffset = 0;
				return;

			default:
				return;
		}
	},
 
	updateFloatingFindBarAppearance : function(aEvent) 
	{
		if (this.findBarPosition != this.kFINDBAR_POSITION_BELOW_TABS) return;

		var bar = this.findBar;
		var target = this.targetBox;

		bar.style.position = 'fixed';
		bar.style.top = target.boxObject.y+'px';
		bar.style.left = target.boxObject.x+'px';

		this.setFloatingFindBarWidth(target.boxObject.width, aEvent);
	},
	
	setFloatingFindBarWidth : function(aWidth, aEvent) 
	{
		if (aEvent &&
			aEvent.type == 'TreeStyleTabAutoHideStateChange' &&
			aEvent.shown &&
			aEvent.xOffset)
			aWidth -= aEvent.xOffset;

		var bar = this.findBar;
		bar.style.width = aWidth+'px';
		var box = document.getAnonymousElementByAttribute(bar, 'anonid', 'findbar-container');
		if (box) box.style.width = bar.style.width;
	},
   
/* Override FindBar */ 
	
	overrideFindBar : function() 
	{
		this.replaceFindBarMethods();
		this.updateFindBarMethods();
	},
	replaceFindBarMethods : function()
	{
		/*
			基本ポリシー：
			Firefox 3.5～4.0の間でメソッド名などが異なる場合は、
			すべてFirefox 4.0に合わせる。
		*/

		// for View Source etc.
		if (!('gFindBar' in window)) window.gFindBar = this.findBar;

		gFindBar.xmigemoOriginalFindNext = function() {
			gFindBar.xmigemoOriginalOnFindAgainCommand(false);
		};
		gFindBar.xmigemoOriginalFindPrevious = function() {
			gFindBar.xmigemoOriginalOnFindAgainCommand(true);
		};

		gFindBar.xmigemoOriginalEnableFindButtons = gFindBar._enableFindButtons;
		gFindBar._enableFindButtons = this.enableFindButtons;

		// disable Firefox's focus
		eval('gFindBar.close = '+gFindBar.close.toSource().replace(
			'if (focusedElement) {',
			'if (focusedElement && false) {'
		));

		eval('gFindBar._updateFindUI = '+gFindBar._updateFindUI.toSource()
			.replace(
				/(var showMinimalUI = )([^;]+)/,
				'$1(XMigemoUI.findMode == XMigemoUI.FIND_MODE_NATIVE && $2)'
			).replace(
				/if \((this._findMode == this.(FIND_TYPEAHEAD|FIND_LINKS))\)/g,
				'if ($1 && XMigemoUI.findMode == XMigemoUI.FIND_MODE_NATIVE)'
			).replace(
				/(\}\)?)$/,
				'XMigemoUI.updateFindUI();$1'
			)
		);

		gFindBar.xmigemoOriginalOpen  = gFindBar.open;
		gFindBar.xmigemoOriginalClose = gFindBar.close;
		gFindBar.open                 = this.openFindBar;
		gFindBar.close                = this.closeFindBar;

		gFindBar.xmigemoOriginalToggleHighlight = gFindBar.toggleHighlight;
		gFindBar.toggleHighlight = this.toggleHighlight;

		gFindBar.prefillWithSelection = false; // disable Firefox's native feature
	},
	updateFindBarMethods : function()
	{
		eval('gFindBar._find = '+gFindBar._find.toSource()
			.replace(/(this._updateStatusUI\([^\)]*\))/, '$1; XMigemoFind.scrollSelectionToCenter(window._content);')
			.replace(/\{/, '{ XMigemoUI.presetSearchString(arguments.length ? arguments[0] : null); ')
		);
		eval('gFindBar.xmigemoOriginalFindNext = '+gFindBar.xmigemoOriginalFindNext.toSource()
			.replace(/(return res;)/, 'XMigemoFind.scrollSelectionToCenter(window._content); $1')
		);
		eval('gFindBar.xmigemoOriginalFindPrevious = '+gFindBar.xmigemoOriginalFindPrevious.toSource()
			.replace(/(return res;)/, 'XMigemoFind.scrollSelectionToCenter(window._content); $1')
		);

		eval('gFindBar._findAgain = '+gFindBar._findAgain.toSource()
			.replace(/(return res;)/, 'XMigemoFind.scrollSelectionToCenter(window._content); $1')
		);

		eval('gFindBar._highlightDoc = '+gFindBar._highlightDoc.toSource()
			.replace(
				'if (!aWord) {',
				<![CDATA[
					if (aWord && aWord != this._lastHighlightString) {
						XMigemoUI.clearHighlight(win.document);
					}
					else $& XMigemoUI.clearHighlight(win.document);
				]]>.toString()
			).replace(
				'return textFound;',
				'XMigemoUI.clearHighlight(doc); $&'
			).replace(
				'this._highlight(aHighlight, retRange, controller);',
				'this._highlight(aHighlight, retRange, controller, aWord);'
			).replace(
				/if \((!doc \|\| )(!\("body" in doc\)|!\(doc instanceof HTMLDocument\))\)/,
				'if ($1($2 && (!XMigemoUI.workForAnyXMLDocuments || !(doc instanceof XMLDocument))))'
			).replace(
				'doc.body',
				'XMigemoUI.getDocumentBody(doc)'
			).replace(
				'var retRange = null;',
				<![CDATA[
					if (XMigemoUI.isActive || !XMigemoUI.highlightSelectionOnly) {
						if (!aHighlight) XMigemoUI.clearHighlight(doc);
						if (XMigemoUI.highlightText(aHighlight, aWord, null, this._searchRange)) {
							this._lastHighlightString = aWord;
							return true;
						}
						else {
							return false;
						}
					}
					$&
				]]>.toString()
			)
		);
		eval('gFindBar.xmigemoOriginalToggleHighlight = '+gFindBar.xmigemoOriginalToggleHighlight.toSource()
			.replace(
				')',
				', aAutoChecked, aKeepLastStatus)'
			).replace(
				/(this\._updateStatusUI\([^\)]+\);)/g,
				'if (!aKeepLastStatus) { $1 }'
			)
		);
/*
		var setter = gFindBar.__lookupSetter__('browser');
		var getter = gFindBar.__lookupGetter__('browser');
		eval('setter = '+setter.toSource()
			.replace(
				/this._browser.(?:add|remove)EventListener\("(keypress|mouseup)"[^\)]+(true|false)\);/g,
				function(aMatch) {
					try {
						if (gFindBar._browser)
							gFindBar._browser.removeEventListener(RegExp.$1, gFindBar, RegExp.$2 == 'true');
					}
					catch(e) {
					}
					return '';
				}
			)
		);
		gFindBar.__defineSetter__('browser', setter);
		gFindBar.__defineGetter__('browser', getter);
*/

		eval('gFindBar._setHighlightTimeout ='+
			gFindBar._setHighlightTimeout.toSource()
			.replace(
				/^(\(?function)([^\(]*)\(\) \{/,
				<![CDATA[$1$2(aAutoChecked) {
					if (XMigemoUI.findTerm == XMigemoUI.activeBrowser.contentDocument.documentElement.getAttribute(XMigemoUI.kLAST_HIGHLIGHT))
						return;
				]]>
			).replace(
				/(\w+\.toggleHighlight\(false)(\);)/,
				<![CDATA[
					var checked = !XMigemoUI.highlightCheck.disabled && XMigemoUI.highlightCheck.checked;
					$1, false, true$2
					if (checked)
						XMigemoUI.textUtils.setSelectionLook(XMigemoUI.activeBrowser.contentDocument, true);
				]]>
			).replace(
				/(\b[^\.]+\.toggleHighlight\(true)(\);)/,
				'$1, !checked$2'
			)
		);

		eval('gFindBar.onFindAgainCommand = '+gFindBar.onFindAgainCommand.toSource()
			.replace(/([^=\s]+\.(find|search)String)/g, 'XMigemoUI.getLastFindString($1)')
		);
		gFindBar.xmigemoOriginalOnFindAgainCommand = gFindBar.onFindAgainCommand;
		gFindBar.onFindAgainCommand = function(aFindPrevious) {
			if (aFindPrevious)
				XMigemoFind.findPrevious();
			else
				XMigemoFind.findNext();
		};
		eval('gFindBar.onFindCommand = '+gFindBar.onFindCommand.toSource()
			.replace('{', '$& XMigemoUI.onFindStartCommand();')
		);

		this.field.addEventListener('input', this, true);
		this.field.addEventListener('keypress', this, true);

		if ('nsBrowserStatusHandler' in window)
			eval('nsBrowserStatusHandler.prototype.onLocationChange = '+
				nsBrowserStatusHandler.prototype.onLocationChange.toSource()
					.replace(/([^\.\s]+\.)+findString/, '((XMigemoUI.findMode != XMigemoUI.FIND_MODE_NATIVE) ? XMigemoFind.lastKeyword : $1findString)')
			);

		var findNext = this.findNextButton;
		findNext.setAttribute('long-label', findNext.getAttribute('label'));
		findNext.setAttribute('short-label', this.findMigemoBar.getAttribute('findNext-short-label'));

		var findPrevious = this.findPreviousButton;
		findPrevious.setAttribute('long-label', findPrevious.getAttribute('label'));
		findPrevious.setAttribute('short-label', this.findMigemoBar.getAttribute('findPrevious-short-label'));

		var caseSensitive = this.caseSensitiveCheck;
		caseSensitive.setAttribute('long-label', caseSensitive.getAttribute('label'));
		caseSensitive.setAttribute('short-label', this.findMigemoBar.getAttribute('caseSensitive-short-label'));

		var highlight = this.highlightCheck;
		highlight.setAttribute('long-label', highlight.getAttribute('label'));
		highlight.setAttribute('short-label', this.findMigemoBar.getAttribute('highlight-short-label'));
	},
 
	getLastFindString : function(aString) 
	{
		var migemoString = XMigemoFind.previousKeyword || XMigemoFind.lastKeyword;
		return (this.lastFindMode == this.FIND_MODE_NATIVE) ? (aString || migemoString) : (migemoString || aString) ;
	},
 
	presetSearchString : function(aString) 
	{
		if (this.shouldIgnoreFindLinksOnlyBehavior) return;

		if (!aString)
			aString = this.findTerm;

		/*
			accessibility.typeaheadfind.linksonlyがtrueの時に
			検索バッファが空のままnsITypeAheadFind.findを実行すると、
			常にリンクのみの検索になってしまう。
			何か1文字だけでも検索すれば、正常に検索できる。
		*/
		try {
			var fastFind = getBrowser().fastFind;
			if (XMigemoService.getPref('accessibility.typeaheadfind.linksonly') &&
				!fastFind.searchString) {
				var res = fastFind.find(sel.charAt(0), false);
				fastFind.findPrevious();
			}
		}
		catch(e) {
		}
	},
	shouldIgnoreFindLinksOnlyBehavior : true,
 
	openFindBar : function(aShowMinimalUI) 
	{
		var ui = XMigemoUI;
		ui.updateFindModeOnOpen(
			(aShowMinimalUI ? ui.FIND_MODE_NATIVE : 0 ),
			(aShowMinimalUI != ui.isQuickFind)
		);
		if (aShowMinimalUI) ui.isQuickFind = true;

		var scope = window.gFindBar ? window.gFindBar : this ;
		scope.xmigemoOriginalOpen.apply(scope, arguments);
		ui.findMigemoBar.removeAttribute('collapsed');

		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindBarOpen', true, false);
		event.isQuickFind = aShowMinimalUI;
		ui.findBar.dispatchEvent(event);
	},
	
	updateFindModeOnOpen : function(aOverrideMode, aSwitchQuickFindMode) 
	{
		if (this.forcedFindMode > -1 &&
			this.findMode != this.forcedFindMode &&
			(this.hidden || aSwitchQuickFindMode))
			this.findMode = this.forcedFindMode;

		if (aOverrideMode)
			this.findMode = aOverrideMode;

		if (this.findMode != this.FIND_MODE_NATIVE && !this.isActive) {
			this.isActive = true;
			this.lastFindMode = this.findMode;
		}
		else if (this.findMode == this.FIND_MODE_NATIVE) {
			this.isActive = false;
			this.lastFindMode = this.findMode;
		}
	},
  
	closeFindBar : function() 
	{
		var scope = window.gFindBar ? window.gFindBar : this ;
		scope.xmigemoOriginalClose.apply(scope, arguments);

		if (XMigemoUI.hidden) {
			XMigemoUI.findModeSelectorBox.setAttribute('hidden', true);
			XMigemoUI.findMigemoBar.setAttribute('collapsed', true);
		}
		XMigemoUI.cleanUpOnFindBarHidden();

		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindBarClose', true, false);
		XMigemoUI.findBar.dispatchEvent(event);

		window.setTimeout(function(aSelf) {
			aSelf.delayedCloseFindBar();
		}, 0, XMigemoUI);
	},
	
	delayedCloseFindBar : function() 
	{
		if (this.hidden) {
			this.findModeSelectorBox.setAttribute('hidden', true);
			this.findMigemoBar.setAttribute('collapsed', true);
		}

		if (this.isActive) {
			this.cancel(true);
		}

		this.isActive = false;

		this.updateCaseSensitiveCheck();

		this.clearHighlight(this.activeBrowser.contentDocument, true);
		this.lastHighlightedKeyword = null;

		var WindowWatcher = Components
				.classes['@mozilla.org/embedcomp/window-watcher;1']
				.getService(Components.interfaces.nsIWindowWatcher);
		if (window == WindowWatcher.activeWindow &&
			this.focused) {
			var scrollSuppressed = document.commandDispatcher.suppressFocusScroll;
			document.commandDispatcher.suppressFocusScroll = true;
			XMigemoFind.exitFind(true);
			document.commandDispatcher.suppressFocusScroll = scrollSuppressed;
		}

		this.clearFocusRing();
		var link = XMigemoFind.getParentLinkFromRange(this.lastFoundRange);
		if (link) link.focus();
	},
  
/* highlight */ 
	
	toggleHighlight : function(aHighlight, aAutoChecked) 
	{
		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindBarUpdateHighlight', true, false);
		event.targetHighlight = aHighlight;
		XMigemoUI.findBar.dispatchEvent(event);

		if (XMigemoUI.highlightCheckedAlways && aAutoChecked) {
			XMigemoUI.stopDelayedToggleHighlightTimer();
			XMigemoUI.delayedToggleHighlightTimer = window.setTimeout(function() {
				XMigemoUI.stopDelayedToggleHighlightTimer();
				var highlight = XMigemoUI.shouldHighlightAll;
				var disabled = XMigemoUI.highlightCheck.disabled;
				var checked = XMigemoUI.highlightCheck.checked;
				if (!XMigemoUI.findTerm || !checked) highlight = false;
				XMigemoUI.toggleHighlight(highlight, false, true);
			}, 10);
			return;
		}

		event = document.createEvent('Events');
		event.initEvent('XMigemoFindBarToggleHighlight', true, false);
		event.targetHighlight = aHighlight;
		XMigemoUI.findBar.dispatchEvent(event);

		if (!aHighlight)
			XMigemoUI.activeBrowser.contentDocument.documentElement.removeAttribute(XMigemoUI.kLAST_HIGHLIGHT);

		var scope = window.gFindBar ? window.gFindBar : this ;
		scope.xmigemoOriginalToggleHighlight.apply(scope, arguments);
	},
 
	stopDelayedToggleHighlightTimer : function() 
	{
		if (!this.delayedToggleHighlightTimer) return;
		window.clearTimeout(this.delayedToggleHighlightTimer);
		this.delayedToggleHighlightTimer = null;
	},
	delayedToggleHighlightTimer : null,
 
	clearHighlight : function(aDocument, aRecursively) 
	{
		var keepFoundHighlighted = !this.highlightCheck.disabled && this.highlightCheck.checked;
		migemo.clearHighlight(aDocument, aRecursively, this.highlightSelectionOnly, keepFoundHighlighted);
	},
 
	highlightText : function(aDoHighlight, aWord, aBaseNode, aRange) 
	{
		var flags = this.shouldCaseSensitive ? '' : 'i' ;
		var regexp = this.findMode == this.FIND_MODE_REGEXP ?
					new RegExp(this.textUtils.extractRegExpSource(aWord), flags) :
				this.findMode == this.FIND_MODE_MIGEMO ?
					migemo.getRegExp(aWord, flags) :
					new RegExp(this.textUtils.sanitize(aWord), flags) ;

		var doc = aRange.startContainer.ownerDocument || aRange.startContainer;
		if (!this.highlightSelectionOnly && !aBaseNode)
			aBaseNode = this.createNewHighlight(doc);

		var ranges = !aDoHighlight ?
				[migemo.regExpFind(regexp, aRange)] :
			this.highlightSelectionAvailable ?
				migemo.regExpHighlightSelection(regexp, aRange, aBaseNode) :
				migemo.regExpHighlight(regexp, aRange, aBaseNode) ;

		return ranges.length ? true : false ;
	},
	
	createNewHighlight : function(aDocument) 
	{
		var node = aDocument.createElementNS('http://www.w3.org/1999/xhtml', 'span');
		var color = this.highlightSelectionAvailable ?
				'' :
				'color: black; background-color: yellow;' ;
		node.setAttribute('style', color + <![CDATA[
			display: inline;
			font-size: inherit;
			padding: 0;
		]]>.toString());
		node.className = '__mozilla-findbar-search';
		this.updateHighlightNode(node);
		return node;
	},
 
	updateHighlightNode : function(aNode) 
	{
		aNode.setAttribute('onmousedown', <><![CDATA[
			try {
				var xpathResult = this.ownerDocument.evaluate(
						'ancestor::*[contains(" INPUT input TEXTAREA textarea ", concat(" ", local-name(), " "))]',
						this,
						null,
						XPathResult.FIRST_ORDERED_NODE_TYPE,
						null
					);
				if (!xpathResult.singleNodeValue) return;
			}
			catch(e) {
				// permission denied, then this is in the input area!
			}
			var range = document.createRange();
			range.selectNodeContents(this);
			var contents = range.extractContents(true);
			range.selectNode(this);
			range.deleteContents();
			range.insertNode(contents);
			range.detach();
		]]></>);

		XMigemoService.ObserverService.notifyObservers(aNode, 'XMigemo:highlightNodeReaday', null);
	},
 
	onHighlightClickedOrTyped : function(aEvent) 
	{
		alert(aEvent.target);
		alert(aEvent.originalTarget);
	},
   
	updateStatus : function(aStatusText) 
	{
		var bar = this.findBar;
		var field = this.field;
		if (bar && !bar.hidden && field) {
			this.findTerm = aStatusText;
		}
		else if (document.getElementById('statusbar-display')) {
			document.getElementById('statusbar-display').label = aStatusText;
		}
	},
 
	updateFindUI : function() 
	{
		if (this.findMode != this.FIND_MODE_MIGEMO || !this.isQuickFind) return;
		this.label.value = this.findMigemoBar.getAttribute(
			XMigemoFind.isLinksOnly ?
				'main-label-migemo-link' :
				'main-label-migemo-normal'
		);
	},
 
	findNext : function() 
	{
		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindAgain', true, false);
		event.direction = XMigemoFind.FIND_FORWARD;
		document.dispatchEvent(event);

		var keyword = XMigemoUI.findTerm;
		if (XMigemoUI.isActive || XMigemoUI.lastFindMode != XMigemoUI.FIND_MODE_NATIVE) {
			if (XMigemoUI.isModeChanged && keyword) {
				XMigemoUI.findAgain(keyword, XMigemoUI.lastFindMode);
				XMigemoUI.isModeChanged = false;
				return;
			}
			XMigemoFind.findNext(XMigemoUI.hidden);
			if (XMigemoUI.cancelTimer)
				XMigemoUI.startTimer();
			if (!XMigemoUI.hidden && XMigemoUI.isQuickFind)
				XMigemoUI.field.focus();
		}
		else {
			if (XMigemoUI.isModeChanged && keyword) {
				XMigemoUI.findAgain(keyword, XMigemoUI.FIND_MODE_NATIVE);
				XMigemoUI.isModeChanged = false;
				return;
			}
			gFindBar.xmigemoOriginalFindNext();
		}
	},
 
	findPrevious : function() 
	{
		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindAgain', true, false);
		event.direction = XMigemoFind.FIND_BACK;
		document.dispatchEvent(event);

		var keyword = XMigemoUI.findTerm;
		if (XMigemoUI.isActive || XMigemoUI.lastFindMode == XMigemoUI.FIND_MODE_MIGEMO) {
			if (XMigemoUI.isModeChanged && keyword) {
				XMigemoUI.findAgain(keyword, XMigemoUI.lastFindMode);
				XMigemoUI.isModeChanged = false;
				return;
			}
			XMigemoFind.findPrevious(XMigemoUI.hidden);
			if (XMigemoUI.cancelTimer)
				XMigemoUI.startTimer();
			if (!XMigemoUI.hidden && XMigemoUI.isQuickFind)
				XMigemoUI.field.focus();
		}
		else {
			if (XMigemoUI.isModeChanged && keyword) {
				XMigemoUI.findAgain(keyword, XMigemoUI.FIND_MODE_NATIVE);
				XMigemoUI.isModeChanged = false;
				return;
			}
			gFindBar.xmigemoOriginalFindPrevious();
		}
	},
 
	enableFindButtons : function(aEnable) 
	{
		var highlightCheck = XMigemoUI.highlightCheck;
		var caseSensitive  = this.caseSensitiveCheck;
		if (!highlightCheck.disabled) {
			highlightCheck.xmigemoOriginalChecked = highlightCheck.checked;
		}

		var scope = window.gFindBar ? window.gFindBar : this ;
		scope.xmigemoOriginalEnableFindButtons.apply(scope, arguments);

		if (aEnable) {
			XMigemoUI.updateHighlightCheck();
			if (XMigemoUI.caseSensitiveCheckedAlways)
				caseSensitive.checked = true;
		}
		else {
			if (XMigemoUI.highlightCheckedAlways) {
				XMigemoUI.toggleHighlight(false, true);
				XMigemoUI.highlightCheck.checked = false;
			}
		}

		var event = document.createEvent('Events');
		event.initEvent('XMigemoFindBarUpdate', true, false);
		XMigemoUI.findBar.dispatchEvent(event);
	},
	highlightCheckFirst : true,
	updateHighlightCheck : function()
	{
		if (this.updateHighlightCheckTimer) {
			window.clearTimeout(this.updateHighlightCheckTimer);
			this.updateHighlightCheckTimer = null;
		}
		this.updateHighlightCheckTimer = window.setTimeout(this.updateHighlightCheckCallback, 400, this);
	},
	updateHighlightCheckCallback : function(aSelf)
	{
		var highlightCheck = aSelf.highlightCheck;
		var prevHighlightState = highlightCheck.checked;
		var checked =
			!aSelf.findTerm ?
				false :
			aSelf.highlightCheckedAlways ?
				aSelf.shouldHighlightAll :
			aSelf.highlightCheckFirst ?
				XMigemoService.getPref('xulmigemo.checked_by_default.highlight') :
				highlightCheck.xmigemoOriginalChecked ;
		highlightCheck.checked = checked;
		if (checked != prevHighlightState) {
			aSelf.toggleHighlight(checked, true);
		}
		aSelf.highlightCheckFirst = false;
	},
	updateHighlightCheckTimer : null,
 
	updateCaseSensitiveCheck : function(aSilently) 
	{
		var caseSensitive = this.caseSensitiveCheck;
		if (this.isActive && this.findMode == this.FIND_MODE_MIGEMO) {
			caseSensitive.xmigemoOriginalChecked = caseSensitive.checked;
			caseSensitive.checked  = false;
			caseSensitive.disabled = true;
			return;
		}

		caseSensitive.disabled = false;

		if (this.textUtils.isRegExp(this.findTerm) &&
			this.findMode == this.FIND_MODE_REGEXP) {
			caseSensitive.xmigemoOriginalChecked = caseSensitive.checked;
			caseSensitive.checked = !/\/[^\/]*i[^\/]*$/.test(this.findTerm);
		}
		else if ('xmigemoOriginalChecked' in caseSensitive) {
			caseSensitive.checked  = caseSensitive.xmigemoOriginalChecked;
			delete caseSensitive.xmigemoOriginalChecked;
		}
	},
  
	init : function() 
	{
		if (window
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShell)
			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
			.parent) // in subframe
			return;

		this.overrideExtensionsOnInitBefore(); // hacks.js

		this.lastFindMode = this.FIND_MODE_NATIVE;
		this.findBar.setAttribute(this.kTARGET, this.activeBrowser.id);
		this.findBar.addEventListener('XMigemoFindBarOpen', this, false);
		this.findBar.addEventListener('XMigemoFindBarClose', this, false);

		document.addEventListener('XMigemoFindProgress', this, false);
		document.addEventListener('XMigemoFindAgain', this, false);

		var browser = this.browser;
		if (browser) {
			XMigemoFind = Components
				.classes['@piro.sakura.ne.jp/xmigemo/find;1']
				.createInstance(Components.interfaces.xmIXMigemoFind);
			XMigemoFind.target = browser;

			if (browser.getAttribute('onkeypress'))
				browser.setAttribute('onkeypress', '');

			(document.getElementById('appcontent') || browser).addEventListener('keypress', this, true);
		}

		this.updateFindBarPosition();
		this.updateItemOrder();
		this.overrideFindBar();

		this.upgradeFindModePrefs();
		XMigemoService.addPrefListener(this);
		XMigemoService.firstListenPrefChange(this);

		window.setTimeout(function(aSelf) {
			aSelf.delayedInit();
		}, 0, this);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);

		this.overrideExtensionsOnInitAfter(); // hacks.js
	},
	
	delayedInit : function() { 
		window.setTimeout("XMigemoUI.field.addEventListener('blur', XMigemoUI, false);", 0);

		if (XMigemoService.getPref('xulmigemo.findMode.default') > -1)
			this.findMode = XMigemoService.getPref('xulmigemo.findMode.default');
		if (XMigemoService.getPref('xulmigemo.checked_by_default.highlight'))
			this.highlightCheck.checked = this.highlightCheck.xmigemoOriginalChecked = true;
		if (XMigemoService.getPref('xulmigemo.checked_by_default.caseSensitive')) {
			this.caseSensitiveCheck.checked = this.caseSensitiveCheck.xmigemoOriginalChecked = true;
			gFindBar.toggleCaseSensitiveCheckbox(true);
		}

		if (XMigemoService.getPref('xulmigemo.checked_by_default.findbar'))
			gFindBar.open();
	},
  
	destroy : function() 
	{
		XMigemoService.removePrefListener(this);

		this.findBar.removeEventListener('XMigemoFindBarOpen', this, false);
		this.findBar.removeEventListener('XMigemoFindBarClose', this, false);
		document.removeEventListener('XMigemoFindProgress', this, false);
		document.removeEventListener('XMigemoFindAgain', this, false);

		var browser = this.browser;
		if (browser) {
			(document.getElementById('appcontent') || browser).removeEventListener('keypress', this, true);
		}

		this.field.removeEventListener('blur', this, false);
		this.field.removeEventListener('input', this, false);
		this.field.removeEventListener('keypress', this, true);

		window.removeEventListener('unload', this, false);
	},
 
	dummy : null
}; 
  
window.addEventListener('load', XMigemoUI, false); 
window.removeEventListener('DOMContentLoaded', XMigemoUI, false);
 
//obsolete 
function xmFind(){
XMigemoFind.find(false, XMigemoFind.lastKeyword || XMigemoFind.previousKeyword, false);
}
function xmFindPrev(){
XMigemoFind.find(true, XMigemoFind.lastKeyword || XMigemoFind.previousKeyword, false);
}
 
