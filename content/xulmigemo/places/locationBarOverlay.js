var XMigemoLocationBarOverlay = { 
	 
	results : [], 
	lastInput : '',
	lastTerms : [],
	lastFindRegExp : null,
	lastTermsRegExp : null,
	thread : null,

	enabled   : true,
	delay     : 250,
	useThread : false,
 
	Converter : Components 
			.classes['@mozilla.org/intl/texttosuburi;1']
			.getService(Components.interfaces.nsITextToSubURI),
	ThreadManager : Components
			.classes['@mozilla.org/thread-manager;1']
			.getService(Components.interfaces.nsIThreadManager),
	TextUtils : Components
			.classes['@piro.sakura.ne.jp/xmigemo/text-utility;1']
			.getService(Components.interfaces.pIXMigemoTextUtils),

	kXULNS : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
 
/* elements */ 
	
	get bar() 
	{
		return document.getElementById('urlbar');
	},
 
	get input() 
	{
		return this.TextUtils.trim(this.bar.value);
	},
 
	get panel() 
	{
		if (!this._panel)
			this._panel = document.getElementById('PopupAutoCompleteRichResult');
		return this._panel;
	},
	_panel : null,
 
	get throbber() 
	{
		return document.getElementById('urlbar-throbber');
	},
 
	get listbox() 
	{
		return document.getAnonymousNodes(this.panel)[0];
	},
 
	get items() 
	{
		return this.listbox.children;
	},
  
/* status */ 
	 
	get busy() 
	{
		return this.throbber.getAttribute('busy') == 'true';
	},
	set busy(aValue)
	{
		var throbber = this.throbber;
		if (throbber) {
			if (aValue)
				throbber.setAttribute('busy', true);
			else
				throbber.removeAttribute('busy');
		}
		return aValue;
	},
 
	get isBlank() 
	{
		return !this.input;
	},
 
	get isMigemoActive() 
	{
		var input = this.input;
		return (
			this.enabled &&
			XMigemoPlaces.isValidInput(input)
			);
	},
  
/* event handling */ 
	 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = XMigemoService.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'xulmigemo.places.locationBar':
				this.enabled = value;
				return;

			case 'xulmigemo.places.locationBar.delay':
				this.delay = value;
				return;

			case 'xulmigemo.places.locationBar.useThread':
				this.useThread = value;
				return;

			default:
				return;
		}
	},
	domains : [
		'xulmigemo.places.locationBar'
	],
	preferences : <![CDATA[
		xulmigemo.places.locationBar
		xulmigemo.places.locationBar.delay
		xulmigemo.places.locationBar.useThread
	]]>.toString(),
 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'load':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;
		}
	},
 
	onSearchBegin : function() 
	{
		var controller = this.bar.controller;
		controller.resultsOverride      = [];
		controller.searchStringOverride = '';
		controller.matchCountOverride   = 0;

		if (this.lastInput == this.input)
			return;

		this.clear();

		if (!this.isMigemoActive) return;

		this.delayedStartTimer = window.setTimeout(function(aSelf) {
			aSelf.clear();
			aSelf.lastInput = aSelf.input;
			if (aSelf.lastInput)
				aSelf.delayedStart();
		}, this.delay, this);
	},
	 
	delayedStart : function() 
	{
		this.bar.controller.stopSearch();
		this.updateRegExp();
		this.builtCount = 0;
		this.busy = true;

		if (this.useThread) { // thread mode
			this.thread = this.ThreadManager.newThread(0);
			this.threadDone = false;
			var maxResults = this.panel.maxResults;
			this.progressiveBuildTimer = window.setInterval(function(aSelf) {
				if (aSelf.isMigemoActive)
					aSelf.progressiveBuild();
				if (!aSelf.isMigemoActive ||
					aSelf.threadDone ||
					aSelf.results.length >= maxResults) {
					aSelf.busy = false;
					aSelf.stopProgressiveBuild();
				}
			}, 1, this);

			this.thread.dispatch(this, this.thread.DISPATCH_NORMAL);
		}
		else { // timer mode
			function DelayedRunner(aSelf)
			{
				var maxResults = aSelf.panel.maxResults;
				var current = 0;
				while (aSelf.updateResultsForRange(aSelf.lastFindRegExp, aSelf.lastTermsRegExp, current, XMigemoPlaces.chunk))
				{
					aSelf.progressiveBuild();
					if (aSelf.results.length >= maxResults) break;	
					yield;
					current += XMigemoPlaces.chunk;
				}
			}
			var runner = DelayedRunner(this);

			this.progressiveBuildTimer = window.setInterval(function(aSelf) {
				try {
					if (aSelf.isMigemoActive) {
						runner.next();
						return;
					}
				}
				catch(e) {
				}
				aSelf.busy = false;
				aSelf.stopProgressiveBuild();
			}, 1, this);
		}
	},
 
	stopDelayedStart : function() 
	{
		if (!this.delayedStartTimer) return;
		window.clearTimeout(this.delayedStartTimer);
		this.delayedStartTimer = null;
	},
  
	// nsIRunnable 
	run : function()
	{
		var maxResults = this.panel.maxResults;
		var current = 0;
		while (this.updateResultsForRange(this.lastFindRegExp, this.lastTermsRegExp, current, XMigemoPlaces.chunk) &&
			this.results.length < maxResults)
		{
			current += XMigemoPlaces.chunk;
		}
		this.threadDone = true;
	},
	QueryInterface : function(aIID) {
		if (aIID.equals(Components.interfaces.nsIRunnable) ||
			aIID.equals(Components.interfaces.nsISupports))
			return this;
		throw Components.results.NS_ERROR_NO_INTERFACE;
	},
  
	updateRegExp : function() 
	{
		if (XMigemoPlaces.autoStartRegExpFind &&
			this.TextUtils.isRegExp(this.lastInput)) {
			var source = this.TextUtils.extractRegExpSource(this.lastInput);
			this.lastFindRegExp =
				this.lastTermsRegExp = new RegExp(source, 'gim');
		}
		else {
			var terms = XMigemoCore.getRegExps(this.lastInput);
			this.lastFindRegExp = new RegExp(
				(XMigemoService.getPref('xulmigemo.places.enableANDFind') ?
					this.TextUtils.getANDFindRegExpFromTerms(terms) :
					XMigemoCore.getRegExp(this.lastInput)
				),
				'gim'
			);
			this.lastTermsRegExp = new RegExp(
				this.TextUtils.getORFindRegExpFromTerms(terms),
				'gim'
			);
		}
	},
 	
	updateResultsForRange : function(aFindRegExp, aTermsRegExp, aStart, aRange) 
	{
		var sources = XMigemoPlaces.getSourceInRange(
				XMigemoPlaces.placesSourceInRangeSQL,
				aStart, aRange
			);
		if (!sources) return false;
		var terms = sources.match(aFindRegExp);
		if (!terms) return true;
		terms = this.TextUtils.brushUpTerms(terms);
		results = XMigemoPlaces.findLocationBarItemsFromTerms(terms, aTermsRegExp, aStart, aRange);
		this.lastTerms = this.TextUtils.brushUpTerms(this.lastTerms.concat(terms));
		this.results = this.results.concat(results);
		return true;
	},
 
	clear : function() 
	{
		this.stopDelayedStart();
		this.stopProgressiveBuild();

		this.results = [];
		this.lastInput = '';
		this.lastTerms = [];
		this.lastFindRegExp = null;
		this.lastTermsRegExp = null;
		this.threadDone = true;

//		this.bar.closePopup();

		this.busy = false;
	},
 
/* build popup */ 
	builtCount : 0,
	 
	progressiveBuild : function() 
	{
		if (!this.results.length ||
			this.results.length == this.builtCount)
			return;

		var controller = this.bar.controller;
		if (!this.builtCount) {
			controller.searchStringOverride = this.lastInput;
			this.clearListbox();
		}
		for (let i = this.builtCount, maxi = this.results.length; i < maxi; i++)
		{
			this.buildItemAt(i);
		}
		controller.resultsOverride = this.results;
		controller.matchCountOverride = this.results.length;
		this.panel.adjustHeight();
		this.bar.openPopup();
		this.builtCount = this.results.length;
	},
 
	stopProgressiveBuild : function() 
	{
		if (!this.progressiveBuildTimer) return;
		window.clearInterval(this.progressiveBuildTimer);
		this.progressiveBuildTimer = null;
		if (this.thread)
			this.thread.shutdown();
		if (this.isBlank)
			this.bar.closePopup();
	},
 
	buildItemAt : function(aIndex) 
	{
		const listbox = this.listbox;
		var existingCount = listbox.children.length;

		const item = this.results[aIndex];
		item.uri = this.Converter.unEscapeURIForUI('UTF-8', item.uri);

		var node;
		if (aIndex < existingCount) {
			node = listbox.childNodes[aIndex];
			if (node.getAttribute('text') == item.terms &&
				node.getAttribute('url') == item.uri) {
				node.collapsed = false;
				return;
			}
		}
		else {
			node = document.createElementNS(this.kXULNS, 'richlistitem');
		}
		node.setAttribute('image', 'moz-anno:favicon:'+item.icon);
		node.setAttribute('url', item.uri);
		node.setAttribute('title', item.title + (item.tags ? ' \u2013 ' + item.tags : '' ));
		node.setAttribute('type', item.style);
		node.setAttribute('text', item.terms);
		if (aIndex < existingCount) {
			node._adjustAcItem();
			node.collapsed = false;
		}
		else {
			node.className = 'autocomplete-richlistitem';
			listbox.appendChild(node);
		}
	},
 
	clearListbox : function() 
	{
		const items = this.listbox.children;
		Array.prototype.slice.call(items).forEach(function(aItem) {
			aItem.collapsed = true;
		});
	},
  
	init : function() 
	{
		window.removeEventListener('load', this, false);

		this.overrideFunctions();
		this.initLocationBar();

		XMigemoService.addPrefListener(this);
		window.addEventListener('unload', this, false);
	},
	 
	overrideFunctions : function() 
	{
		eval('LocationBarHelpers._searchBegin = '+
			LocationBarHelpers._searchBegin.toSource().replace(
				/(\}\))?$/,
				'XMigemoLocationBarOverlay.onSearchBegin(); $1'
			)
		);

		var panel = this.panel;
		eval('panel._appendCurrentResult = '+
			panel._appendCurrentResult.toSource().replace(
				'{',
				'{ if (XMigemoLocationBarOverlay.isMigemoActive) return;'
			)
		);

		window.__xulmigemo__BrowserCustomizeToolbar = window.BrowserCustomizeToolbar;
		window.BrowserCustomizeToolbar = function() {
			XMigemoLocationBarOverlay.destroyLocationBar();
			window.__xulmigemo__BrowserCustomizeToolbar.call(window);
		};

		var toolbox = document.getElementById('navigator-toolbox');
		if (toolbox.customizeDone) {
			toolbox.__xulmigemo__customizeDone = toolbox.customizeDone;
			toolbox.customizeDone = function(aChanged) {
				this.__xulmigemo__customizeDone(aChanged);
				XMigemoLocationBarOverlay.initLocationBar();
			};
		}
		if ('BrowserToolboxCustomizeDone' in window) {
			window.__xulmigemo__BrowserToolboxCustomizeDone = window.BrowserToolboxCustomizeDone;
			window.BrowserToolboxCustomizeDone = function(aChanged) {
				window.__xulmigemo__BrowserToolboxCustomizeDone.apply(window, arguments);
				XMigemoLocationBarOverlay.initLocationBar();
			};
		}
	},
 
	initLocationBar : function() 
	{
		var bar = this.bar;
		if (!bar || bar.__xmigemo__mController) return;

		const nsIAutoCompleteController = Components.interfaces.nsIAutoCompleteController;
		bar.__xmigemo__mController = bar.mController;
		bar.mController = {
			service    : this,
			get controller()
			{
				return this.service.bar.__xmigemo__mController;
			},
			STATUS_NONE              : nsIAutoCompleteController.STATUS_NONE,
			STATUS_SEARCHING         : nsIAutoCompleteController.STATUS_SEARCHING,
			STATUS_COMPLETE_NO_MATCH : nsIAutoCompleteController.STATUS_COMPLETE_NO_MATCH,
			STATUS_COMPLETE_MATCH    : nsIAutoCompleteController.STATUS_COMPLETE_MATCH,

			searchStringOverride : '',
			matchCountOverride   : 0,
			resultsOverride      : [],

			get input() {
				return this.controller.input;
			},
			set input(aValue) {
				return this.controller.input = aValue;
			},
			get searchStatus(aValue) {
				return this.controller.searchStatus;
			},
			get matchCount() {
				return this.matchCountOverride || this.controller.matchCount;
			},
			startSearch : function(aString) {
				if (this.service.isMigemoActive) return;
				return this.controller.startSearch(aString);
			},
			stopSearch : function() {
				return this.controller.stopSearch();
			},
			handleText : function(aIgnoreSelection) {
				return this.controller.handleText(aIgnoreSelection);
			},
			handleEnter : function(aIsPopupSelection) {
				this.service.clear();
				return this.controller.handleEnter(aIsPopupSelection);
			},
			handleEscape : function() {
				this.service.clear();
				var retval = this.controller.handleEscape();
				if (retval &&
					this.input.textValue == this.searchString &&
					this.searchStringOverride) {
					this.input.textValue = this.searchStringOverride;
				}
				return retval;
			},
			handleStartComposition : function() {
				return this.controller.handleStartComposition();
			},
			handleEndComposition : function() {
				return this.controller.handleEndComposition();
			},
			handleTab : function() {
				return this.controller.handleTab();
			},
			handleKeyNavigation : function(aKey) {
				const nsIDOMKeyEvent = Components.interfaces.nsIDOMKeyEvent;
				var input = this.input;
				var popup = input.popup;
				if (
					(
						aKey == nsIDOMKeyEvent.DOM_VK_UP ||
						aKey == nsIDOMKeyEvent.DOM_VK_DOWN ||
						aKey == nsIDOMKeyEvent.DOM_VK_PAGE_UP ||
						aKey == nsIDOMKeyEvent.DOM_VK_PAGE_DOWN
					) && popup.mPopupOpen
					) {
					var reverse = (aKey == nsIDOMKeyEvent.DOM_VK_UP || aKey == nsIDOMKeyEvent.DOM_VK_PAGE_UP);
					var page = (aKey == nsIDOMKeyEvent.DOM_VK_PAGE_UP || aKey == nsIDOMKeyEvent.DOM_VK_PAGE_DOWN);
					var completeSelection = input.completeSelectedIndex;
					popup.selectBy(reverse, page);
					if (completeSelection) {
						var selectedIndex = popup.selectedIndex;
						if (selectedIndex >= 0) {
							var items = this.service.items;
							input.textValue = items[selectedIndex].getAttribute('url');
						}
						else {
							input.textValue = this.searchStringOverride || this.searchString;
						}
						input.selectTextRange(input.textValue.length, input.textValue.length);
					}
					return true;
				}
				return this.controller.handleKeyNavigation(aKey);
			},
			handleDelete : function() {
				return this.controller.handleDelete();
			},
			getValueAt : function(aIndex) {
				if (this.resultsOverride.length)
					return this.resultsOverride[aIndex].uri;
				return this.controller.getValueAt(aIndex);
			},
			getCommentAt : function(aIndex) {
				if (this.resultsOverride.length)
					return this.resultsOverride[aIndex].title;
				return this.controller.getCommentAt(aIndex);
			},
			getStyleAt : function(aIndex) {
				if (this.resultsOverride.length)
					return this.resultsOverride[aIndex].style;
				return this.controller.getStyleAt(aIndex);
			},
			getImageAt : function(aIndex) {
				if (this.resultsOverride.length)
					return this.resultsOverride[aIndex].icon;
				return this.controller.getImageAt(aIndex);
			},
			get searchString() {
				return this.searchStringOverride || this.controller.searchString;
			},
			set searchString(aValue) {
				return this.controller.searchString = aValue;
			},
			QueryInterface : function(aIID) {
				if (aIID.equals(Components.interfaces.nsIAutoCompleteController) ||
					aIID.equals(Components.interfaces.nsISupports))
					return this;
				throw Components.results.NS_ERROR_NO_INTERFACE;
			}
		};
	},
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);
		this.destroyLocationBar();
		XMigemoService.removePrefListener(this);
	},
	 
	destroyLocationBar : function() 
	{
		var bar = this.bar;
		if (!bar || !bar.__xmigemo__mController) return;

		bar.mController.stopSearch();
		bar.mController.service = null;
		bar.mController = bar.__xmigemo__mController;
	}
  
}; 
 
window.addEventListener('load', XMigemoLocationBarOverlay, false); 
  
