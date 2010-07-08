var XMigemoMarker = { 
	enabled  : false,
	get requireDOMHighlight()
	{
		return this.enabled;
	},

	kCANVAS : '__moz_xmigemo-found-marker-canvas',

	size    : 10,
	padding : 5,
	fill    : '',
	fillActive : '',
	stroke  : '',
	strokeActive : '',
	 
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
 
	init : function() 
	{
		window.removeEventListener('load', this, false);
		if (window
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShell)
			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
			.parent) // in subframe
			return;

		window.addEventListener('unload', this, false);

		XMigemoService.addPrefListener(this);
		XMigemoService.firstListenPrefChange(this);

		var bar = XMigemoUI.findBar;
		bar.addEventListener('XMigemoFindBarOpen', this, false);
		bar.addEventListener('XMigemoFindBarClose', this, false);
		bar.addEventListener('XMigemoFindBarToggleHighlight', this, false);
		bar.addEventListener('XMigemoFindBarUpdateHighlight', this, false);
		document.addEventListener('XMigemoFindAgain', this, false);
		document.addEventListener('SubBrowserFocusMoved', this, false);

		XMigemoUI.registerHighlightUtility(this);
		if ('XMigemoHighlight' in window)
			XMigemoHighlight.registerEventCanceler(this);

		this.initScrollBarSize();
	},
	 
	initScrollBarSize : function() 
	{
		var vbox = document.createElement('box');
		vbox.setAttribute('class', 'xmigemo-marker-dummyScrollbarBox');
		var vbar = vbox.appendChild(document.createElement('scrollbar'));
		vbar.setAttribute('orient', 'vertical');
		document.documentElement.appendChild(vbox);

		var hbox = document.createElement('box');
		hbox.setAttribute('class', 'xmigemo-marker-dummyScrollbarBox');
		var hbar = hbox.appendChild(document.createElement('scrollbar'));
		hbar.setAttribute('orient', 'horizontal');
		document.documentElement.appendChild(hbox);

		window.setTimeout(function(aSelf) {
			aSelf.scrollBarWidth = vbar.boxObject.width;
			aSelf.scrollBarHeight = hbar.boxObject.height;
			aSelf.scrollButtonWidth = (
				document.getAnonymousElementByAttribute(hbar, 'sbattr', 'scrollbar-up-top').boxObject.width ||
				document.getAnonymousElementByAttribute(hbar, 'sbattr', 'scrollbar-up-bottom').boxObject.width
			);
			aSelf.scrollButtonHeight = (
				document.getAnonymousElementByAttribute(vbar, 'sbattr', 'scrollbar-up-top').boxObject.height ||
				document.getAnonymousElementByAttribute(vbar, 'sbattr', 'scrollbar-up-bottom').boxObject.height
			);
			vbox.parentNode.removeChild(vbox);
			hbox.parentNode.removeChild(hbox);
		}, 0, this);
	},
	scrollBarWidth : 0,
	scrollBarHeight : 0,
	scrollButtonWidth : 0,
	scrollButtonHeight : 0,
 	 
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);

		XMigemoService.removePrefListener(this);

		var bar = XMigemoUI.findBar;
		bar.removeEventListener('XMigemoFindBarOpen', this, false);
		bar.removeEventListener('XMigemoFindBarClose', this, false);
		bar.removeEventListener('XMigemoFindBarToggleHighlight', this, false);
		bar.removeEventListener('XMigemoFindBarUpdateHighlight', this, false);
		document.removeEventListener('XMigemoFindAgain', this, false);
		document.removeEventListener('SubBrowserFocusMoved', this, false);

		XMigemoUI.unregisterHighlightUtility(this);
		if ('XMigemoHighlight' in window)
			XMigemoHighlight.unregisterEventCanceler(this);
	},
 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'load':
				window.setTimeout('XMigemoMarker.init();', 0);
				return;

			case 'unload':
				this.destroy();
				return;

			case 'XMigemoHighlight:mouseup':
				if (this.dragging) return true;
			case 'XMigemoHighlight:mousedown':
				return this.isEventFiredOnMarkers(aEvent.originalEvent);

			case 'mousedown':
				this.onMouseDown(aEvent);
				return;

			case 'mouseup':
				this.onMouseUp(aEvent);
				return;

			case 'mousemove':
				this.onMouseMove(aEvent);
				return;

			case 'XMigemoFindBarOpen':
				window.setTimeout(function(aSelf) {
					if (XMigemoUI.hidden ||
						!aSelf.enabled ||
						XMigemoUI.highlightCheck.disabled ||
						!XMigemoUI.highlightCheck.checked)
						return;
					aSelf.startListen();
					aSelf.toggleMarkers(true);
				}, 0, this);
				break;

			case 'XMigemoFindBarClose':
				window.setTimeout(function(aSelf) {
					if (!aSelf.enabled) return;
					aSelf.stopListen();
					aSelf.destroyMarkers();
				}, 0, this);
				break;

			case 'XMigemoFindBarToggleHighlight':
				if (this.toggleTimer) {
					window.clearTimeout(this.toggleTimer);
					this.toggleTimer = null;
				}
				this.toggleTimer = window.setTimeout(function(aSelf, aHighlight) {
					aSelf.toggleTimer = null;
					if (!aSelf.enabled) return;
					aSelf.toggleMarkers(aHighlight);
					if (aHighlight)
						aSelf.startListen();
					else
						aSelf.stopListen();
				}, 10, this, aEvent.targetHighlight);
				break;

			case 'XMigemoFindBarUpdateHighlight':
				this.redrawMarkersWithDelay(aEvent.targetHighlight);
				break;

			case 'XMigemoFindAgain':
				this.redrawMarkersWithDelay(true);
				break;

			case 'resize':
				this.redrawMarkersWithDelay(true, true);
				break;

			case 'SubBrowserFocusMoved':
				this.destroyMarkers(aEvent.lastFocused.browser);
				break;
		}
	},
	 
	isEventFiredOnMarkers : function(aEvent) 
	{
		return (aEvent.target.nodeType == Node.ELEMENT_NODE &&
			aEvent.target.getAttribute('id') == this.kCANVAS);
	},
 
	onMouseDown : function(aEvent) 
	{
		if (!this.isEventFiredOnMarkers(aEvent))
			return;

		aEvent.preventDefault();
		aEvent.stopPropagation();
		this.scrollTo(aEvent.target, aEvent.clientY);

		this.dragging = true;
		XMigemoUI.isScrolling = true;
	},
	 
	scrollTo : function(aNode, aY, aDisableAnimation) 
	{
		var doc = aNode.ownerDocument || aNode;
		var w = doc.defaultView;
		if (w.__xulmigemo__markerSmoothScrollTask) {
			XMigemoService.animationManager.removeTask(w.__xulmigemo__markerSmoothScrollTask);
			w.__xulmigemo__markerSmoothScrollTask = null;
		}

		var canvas = doc.getElementById(this.kCANVAS);
		if (!canvas) return;

		var size = XMigemoService.getDocumentSizeInfo(doc);
		var height = size.viewHeight;
		if (size.xScrollable) height -= this.scrollBarHeight;
		if (height <= 0) return;

		var topOffset = this.scrollButtonHeight;
		var availableHeight = height - (topOffset * 2);

		var finalX = Math.max(0, w.scrollX);
		var finalY = Math.min(w.scrollMaxY, ((aY - topOffset) / availableHeight * size.height) - (height / 2));

		if (aDisableAnimation ||
			!XMigemoService.getPref('xulmigemo.highlight.foundMarker.smoothScroll.enabled')) {
			w.scrollTo(finalX, finalY);
			return;
		}

		var startX = w.scrollX;
		var startY = w.scrollY;
		var deltaX = finalX - startX;
		var deltaY = finalY - startY;
		var radian = 90 * Math.PI / 180;
		var self   = this;
		w.__xulmigemo__markerSmoothScrollTask = function(aTime, aBeginning, aChange, aDuration) {
			var x, y, finished;
			if (aTime >= aDuration) {
				w.__xulmigemo__markerSmoothScrollTask = null;
				x = finalX;
				y = finalY
				finished = true;
			}
			else {
				x = startX + (deltaX * Math.sin(aTime / aDuration * radian));
				y = startY + (deltaY * Math.sin(aTime / aDuration * radian));
				finished = false;
			}
			w.scrollTo(x, y);
			return finished;
		};
		XMigemoService.animationManager.addTask(
			w.__xulmigemo__markerSmoothScrollTask,
			0, 0, XMigemoService.getPref('xulmigemo.highlight.foundMarker.smoothScroll.duration')
		);
	},
	smoothScrollDuration : 250,
  
	onMouseUp : function(aEvent) 
	{
		if (!this.dragging) return;
		aEvent.preventDefault();
		aEvent.stopPropagation();
		this.dragging = false;
		XMigemoUI.isScrolling = false;
	},
 
	onMouseMove : function(aEvent) 
	{
		if (!this.dragging) return;
		aEvent.preventDefault();
		aEvent.stopPropagation();
		this.scrollTo(aEvent.target, aEvent.clientY, true);
	},
 
	startListen : function() 
	{
		if (this.listening) return;
		this.listening = true;
		var target = document.getElementById('appcontent') || XMigemoUI.browser;
		if (target) {
			target.addEventListener('mousedown', this, true);
			target.addEventListener('mouseup', this, true);
			target.addEventListener('mousemove', this, true);
		}
		window.addEventListener('resize', this, false);
	},
 
	stopListen : function() 
	{
		if (!this.listening) return;
		this.listening = false;
		var target = document.getElementById('appcontent') || XMigemoUI.browser;
		if (target) {
			target.removeEventListener('mousedown', this, true);
			target.removeEventListener('mouseup', this, true);
			target.removeEventListener('mousemove', this, true);
		}
		window.removeEventListener('resize', this, false);
	},
  
	observe : function(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				var value = XMigemoService.getPref(aData);
				switch (aData)
				{
					case 'xulmigemo.highlight.foundMarker.enabled':
						this.enabled = value;
						break;

					case 'xulmigemo.highlight.foundMarker.size':
						this.size = value;
						break;

					case 'xulmigemo.highlight.foundMarker.padding':
						this.padding = value;
						break;

					case 'xulmigemo.highlight.foundMarker.fill':
						this.fill = value;
						break;

					case 'xulmigemo.highlight.foundMarker.fill.active':
						this.fillActive = value;
						break;

					case 'xulmigemo.highlight.foundMarker.stroke':
						this.stroke = value;
						break;

					case 'xulmigemo.highlight.foundMarker.stroke.active':
						this.strokeActive = value;
						break;
				}
				break;
		}
	},
	domain  : 'xulmigemo.highlight.foundMarker',
	preferences : <><![CDATA[
		xulmigemo.highlight.foundMarker.enabled
		xulmigemo.highlight.foundMarker.size
		xulmigemo.highlight.foundMarker.padding
		xulmigemo.highlight.foundMarker.fill
		xulmigemo.highlight.foundMarker.stroke
		xulmigemo.highlight.foundMarker.fill.active
		xulmigemo.highlight.foundMarker.stroke.active
	]]></>.toString(),
 
/* rendering position markers */ 
	 
	initializeMarkers : function(aFrame, aDontFollowSubFrames) 
	{
		if (!aFrame)
			aFrame = XMigemoUI.activeBrowser.contentWindow;

		if (!aDontFollowSubFrames && aFrame.frames && aFrame.frames.length) {
			Array.slice(aFrame.frames).forEach(arguments.callee, this);
		}

		var doc = aFrame.document;
		if (doc.getElementById(this.kCANVAS))
			return;

		var bodies = doc.getElementsByTagName('body');
		if (bodies.length == 0)
			return;

		var size = XMigemoService.getDocumentSizeInfo(doc);
		if (!size.height || !size.viewHeight) return;

		if (!XMigemoService.useGlobalStyleSheets)
			XMigemoService.addStyleSheet('chrome://xulmigemo/content/marker.css', doc);

		var objBody = bodies[0];
		var canvas = doc.createElementNS(XMigemoUI.kXHTMLNS, 'canvas');
		canvas.setAttribute('id', this.kCANVAS);
		canvas.setAttribute('class', '__moz_xmigemo-positioned');
		canvas.setAttribute('title', XMigemoService.strbundle.getString('marker.tooltip'));
		canvas.setAttribute(
			'style',
			'width: '+(this.size+this.padding)+'px !important'
		);
		canvas.width = this.size+this.padding;
		var height = size.viewHeight;
		if (size.xScrollable) height -= this.scrollBarHeight;
		canvas.height = height;
		objBody.insertBefore(canvas, objBody.firstChild);

		this.drawMarkers(doc);
	},
 
	redrawMarkers : function(aFrame, aResize) 
	{
		if (!aFrame)
			aFrame = XMigemoUI.activeBrowser.contentWindow;

		if (aFrame.frames && aFrame.frames.length) {
			Array.slice(aFrame.frames).forEach(arguments.callee, this);
		}

		this.drawMarkers(aFrame.document);
	},
	 
	drawMarkers : function(aDocument, aResize) 
	{
		var canvas = aDocument.getElementById(this.kCANVAS);
		if (!canvas) return;

		var size = XMigemoService.getDocumentSizeInfo(aDocument);
		var highlights = XMigemoCore.getHighlights(aDocument);

		var viewHeight = size.viewHeight;
		if (size.xScrollable) viewHeight -= this.scrollBarHeight;

		if (aResize) canvas.height = viewHeight;

		var topOffset = this.scrollButtonHeight;
		var heightOffset = (topOffset * 2) + this.scrollBarHeight;

		var availHeight = viewHeight - (topOffset * 2);
		var focusedRange = this.textUtils.getFoundRange(aDocument.defaultView);
		if (focusedRange) focusedRange = focusedRange.QueryInterface(Components.interfaces.nsIDOMRange);

		try {
			var ctx = canvas.getContext('2d');
			ctx.save();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.restore();
			var activeMarkerY = -1;
			highlights.forEach(function(aHighlight) {
				var node = aHighlight.node;
				var y = (availHeight * (((node.offsetHeight / 2) + this.getElementY(node)) / size.height)) + topOffset;
				if (focusedRange && activeMarkerY < 0) {
					var range = node.ownerDocument.createRange();
					range.selectNodeContents(node);
					if (this.textUtils.isRangeOverlap(focusedRange, range))
						activeMarkerY = y;
					range.detach();
					if (activeMarkerY > -1) return;
				}
				this.drawMarkerAt(ctx, y);
			}, this);
			if (activeMarkerY > -1)
				this.drawMarkerAt(ctx, activeMarkerY, true);
		}
		catch(e) {
			dump('XMigemoMarker Error: ' + e.message + '\n');
		}
	},
	 
	drawMarkerAt : function(aContext, aY, aActive) 
	{
		var rightEdge = this.size+this.padding;
		var leftEdge = aActive ? (this.padding * 0.5) : this.padding ;
		var halfHeight = ((aActive ? (this.padding * 0.5) : 0 ) + this.size) / 2.5;

		aContext.save();

		aContext.fillStyle = aActive ? this.fillActive : this.fill ;
		aContext.strokeStyle = aActive ? this.strokeActive : this.stroke ;
		aContext.lineWidth = aActive ? 1.5 : 1 ;

		aContext.moveTo(rightEdge, aY);
		aContext.beginPath();
		aContext.lineTo(leftEdge, aY - halfHeight);
		aContext.lineTo(leftEdge, aY + halfHeight);
		aContext.lineTo(rightEdge, aY);
		aContext.fill();
		aContext.closePath();
		aContext.stroke();

		aContext.restore();
	},
 
	getElementY : function(aElement) 
	{
		return !aElement ? 0 : arguments.callee(aElement.offsetParent) + aElement.offsetTop;
	},
  
	redrawMarkersWithDelay : function(aShow, aResize) 
	{
		if (this.redrawTimer) {
			window.clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}
		this.redrawTimer = window.setTimeout(
			function(aSelf) {
				aSelf.redrawTimer = null;
				if (!aSelf.enabled || !aShow) return;
				aSelf.redrawMarkers(null, aResize);
			},
			10,
			this
		);
	},
  
	destroyMarkers : function(aBrowserOrFrame) 
	{
		XMigemoUI.doProcessForAllFrames(this.destroyMarkersInFrame, this, aBrowserOrFrame);
	},
	destroyMarkersInFrame : function(aFrame) 
	{
		var canvas = aFrame.document.getElementById(this.kCANVAS);
		if (canvas) canvas.parentNode.removeChild(canvas);
	},
 
	toggleMarkers : function(aShow, aFrame) 
	{
		if (!aFrame)
			aFrame = XMigemoUI.activeBrowser.contentWindow;

		if (aFrame.__xulmigemo__markerSmoothScrollTask) {
			XMigemoService.animationManager.removeTask(aFrame.__xulmigemo__markerSmoothScrollTask);
			aFrame.__xulmigemo__markerSmoothScrollTask = null;
		}

		Array.slice(aFrame.frames).forEach(function(aFrame) {
			this.toggleMarkers(aShow, aFrame);
		}, this);

		if (!this.isAvailableForDocument(aFrame.document)) return;

		if (aShow)
			this.initializeMarkers(aFrame, true);
		else
			this.destroyMarkersInFrame(aFrame);

		migemo.repaintHighlights(aFrame.document, true);
	},
 
	isAvailableForDocument : function(aDocument) 
	{
		return (
			(aDocument instanceof HTMLDocument) ||
			(XMigemoUI.workForAnyXMLDocuments && (aDocument instanceof XMLDocument))
			);
	},
   
	dummy : null
}; 
 
window.addEventListener('load', XMigemoMarker, false); 
 
