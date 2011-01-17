/*
 * Copyright (C) 2008-2010 WaveMaker Software, Inc.
 *
 * This file is part of WaveMaker Studio.
 *
 * WaveMaker Studio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3 of the License, only.
 *
 * WaveMaker Studio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WaveMaker Studio.  If not, see <http://www.gnu.org/licenses/>.
 */ 
dojo.provide("wm.studio.pages.Studio.Studio");

dojo.require("dojo.cookie");
dojo.require("wm.base.components.Page");
dojo.require("wm.base.widget.Box");
dojo.require("wm.base.widget.Content");
dojo.require("wm.base.widget.Panel");
dojo.require("wm.base.widget.Bevel");
dojo.require("wm.base.widget.Splitter");
dojo.require("wm.base.widget.Button");
dojo.require("wm.base.widget.Picture");
dojo.require("wm.base.widget.Layers");
dojo.require("wm.base.widget.LayoutBox");
dojo.require("wm.base.widget.Tree");
dojo.require("wm.base.design.Designer");
dojo.require("wm.base.layout.console");

//wm.logging = true;

// abort javadoc thing
loadFrames = function() {};

wm.disEnableButton = function(inBtn, inDisEnable) {
	var a = ["setAttribute", "removeAttribute"], d = "disabled";
	inBtn[a[Number(Boolean(inDisEnable))]](d, d);
}

dojo.declare("Studio", wm.Page, {
	// FIXME: flag for testing if we're actual studio class
	// used for automatic studio page unloading.
	_isWaveMakerStudio: true,
	_outlineClass: "Studio-outline",
        _explodeClass: "Studio-exploded",
	studioKeyPriority: false,
        projectPrefix: "",
        userName: "",
        resourcesLastUpdate: 0,
        _deploying: false,
        _runRequested: false,
	//=========================================================================
	// initialization
	//=========================================================================
	start: function() {
	    app._page = this;// not sure why this was failing to set, but I don't have time to investigate...

		try{
		    this.documentationDialog = new wm.RichTextDialog({owner: this, name:"documentationDialog"});
		    this.connect(this.documentationDialog, "onOkClick", this, "saveDocumentation");
		}
		catch(e){
			console.info('error while creating RichTextDialog for documentation.');	
		}
		
            this.trackerImage.setSource("http://wavemaker.com/img/blank.gif?op=studioLoad&v=" + escape(wm.studioConfig.studioVersion) + "&r=" + String(Math.random(new Date().getTime())).replace(/\D/,"").substring(0,8));
		this.project = new wm.studio.Project();
/*
		this.startEditor = studio.addEditor("Start");
		this.startEditor.connect(this.startEditor, "onStart", this, "startPageOnStart");
		*/
	    //this.startPageDialog.fixPositionNode = this.tabs.domNode;

	    this.startPageDialog.show();
	    this.startPageDialog.dialogScrim.domNode.style.opacity = 0.7;
		// set this up now because we won't be able to load it when the session has expired

		// get user configuration settings
		this.initUserSettings();
		// load module configuration
		this.loadModuleConfig();
		// FIXME: hack
		this.owner = app;
	    this.scrim = new wm.Scrim({owner: this, name: "studioScrim", _classes: {domNode: ["wmdialog-scrim"]}, waitCursor: false, _noAnimation: true});
		// populate palettes
		loadPackages();
		// init some UI
		this.outlinedClick();
		if (this.getUserSetting('explode')) {
			this.explodedClick();
		}
		/*
		if (wm.studioConfig.preventLiveData)
			this.liveLayoutBtn.setDisabled(true);
		*/

	    this.bindDialog = this.getBindDialog();

		this.clearTrees();
		this.initConsole();
		// Listen to some events
	    //this.connect(document, "keydown", this, "keydown");
		this.connect(wm.inflight, "change", this, "inflightChange");
		// Unload protection
		if (wm.studioConfig.preventUnloadWarning)
			dojo.connect(window, "onbeforeunload", this, "windowUnload");
		// Listen to some topics
		dojo.subscribe("wm-textsizechange", this, "reflow");
		dojo.subscribe("wmwidget-rename", this, "componentRenamed");
		// set up status update poll 
		// FIXME: can't we do status updates via dojo.publish?
		setInterval(dojo.hitch(this, "updateStatus"), 2000);
		//this.preloadImages();
		this.requestUserName();
		var defaultProject = this.getUserSetting("defaultProject");

		/*
		if (this.isCloud()) {
		    this.startLayer.activate();
		    if (defaultProject) {
			this.startEditor.page.openProjectTab();
			this.startEditor.page.selectProjectInList(defaultProject);
		    }
	} else */
		if (this.getUserSetting("useLop") && defaultProject) {
			this.project.openProject(defaultProject);
		} else { 
		    studio.disableMenuBar(true);
		}
		if (this.isCloud()) {
		    this.navLogoutBtn.setShowing(true);
		    this.navEditAccountBtn.setShowing(true);
		}

	    if (studio.isModuleEnabled("security-driver", "wm.josso")) { // if isEnterprise
		this.setupLicenseInfoLabel();
	    } else {
		this.licenseItem.domNode.style.display = "none";
		var fileMenuItems = studio.navigationMenu.fullStructure[0].children;
		var deleteIndex = wm.Array.indexOf(fileMenuItems, "licenseItem", function(item,value) {return item.idInPage == value;});
		if (deleteIndex != -1)
		    wm.Array.removeElementAt(fileMenuItems, deleteIndex);
	    }



			    /* Removal of projects tab
		this.updateProjectTree();
		*/
		this.subscribe("session-expiration-servicecall", this, "handleSessionExpiration");
		this.subscribe("service-variable-error", this, "handleServiceVariableError");

                this.loadThemeList();
	    this.helpDialog.containerWidget.c$[0].setPadding("0");
	    this.helpDialog.containerWidget.c$[0].setBorder("10");
	    this.helpDialog.containerWidget.c$[0].setBorderColor("#424959");
	    this.scriptPageCompileChkBtn.setChecked(dojo.cookie(this.scriptPageCompileChkBtn.getRuntimeId()) == "true");
	    this.appsrcPageCompileChkBtn.setChecked(dojo.cookie(this.scriptPageCompileChkBtn.getRuntimeId()) == "true");

	    // attempt to allow autoscroll while killing the left-to-right scrolling
	    dojo.connect(studio.tree, "renderCss", studio.tree, function() {
		    this.domNode.style.overflowX = "hidden";
	    });	    


	    this._paletteToDialogButton = document.createElement("div");
	    this._paletteToDialogButton.className = "wmtoolbutton Studio-paletteToDialogButton";
	    studio.left.decorator.tabsControl.domNode.appendChild(this._paletteToDialogButton);
	    dojo.connect(this._paletteToDialogButton, "onclick", this, "togglePaletteDialog");
	    this.propertiesDialog.containerWidget.setPadding("0");
	    this.propertiesDialog.containerWidget.setAutoScroll(false);
	},
/*
	 startPageOnStart: function() {
		this.startLayer = this.startEditor.parent;
		if (!this.getUserSetting("useLop") || !this.getUserSetting("defaultProject")) {
		    this.startLayer.activate();
		}
	 },
	 */
    setupLicenseInfoLabel: function() {
	var licenseService = new wm.JsonRpcService({owner: this, service: "licensingService", sync: false});	
	var licenseDeferred = licenseService.requestAsync("getLicenseExpiration");
	licenseDeferred.addCallback(dojo.hitch(this, "setupLicenseInfoLabelResult"));
    },
    setupLicenseInfoLabelResult: function(inResult) {
		    if (inResult > 30) return; // no display if more than 30 days
		    if (inResult < 0) {
			this.userLabel.setCaption("<div class='Studio_silkIconImageList_59 LicenseIcon'></div> Trial License has expired");
			this.userLabel.removeUserClass("LicenseWarning");			    
			this.userLabel.addUserClass("LicenseError");
			this.startPageDialog.show();
			this.startPageDialog.page.licenseLayer.activate();
		    } else {
			this.userLabel.setCaption("<div class='Studio_silkIconImageList_60 LicenseIcon'></div> Trial license expires in " + inResult + " days");
			if (inResult <= 2)
			    this.userLabel.addUserClass("LicenseWarning");			    

			// if its not expiring for over a month or has already expired, don't bother with this, else retest status every few hours
			if (!this._licenseTestTimeout)
			    this._licenseTestTimeout = window.setInterval(function() {
				var licenseDeferred = licenseService.requestAsync("getLicenseExpiration");
				licenseDeferred.addCallback(dojo.hitch(studio, "setupLicenseInfoLabelResult"));
			    }, 10800000); // every 3 hours update the license info label
		    }
    },
	 handleServiceVariableError: function(inServiceVar, inError) {
	   studio.endWait();  // if there was a beginWait call in progress, then we'd best close it in case there is no suitable error handler for the call
	 },
	handleSessionExpiration: function(serviceVar) {
	    if (serviceVar.isDesignLoaded()) {
		this.statusBarLabel.setCaption("Security Error <span class='StudioHelpIcon'/>");
		var node = dojo.query(".StudioHelpIcon", this.statusBarLabel.domNode)[0];
		dojo.connect(node, "onmouseover", this, function(e) {
		    app.createToolTip("A security error shown here has no effect on the project you are designing.  It does indicate that we are unable to show your data within the designer.  You can typically fix this problem by running your application, logging in to your application, and then the data should show up in the designer", node, e);
		});
		dojo.connect(node, "onmouseout", this, function() {
		    app.hideToolTip();
		});
		
	    } else {
		if (!this.isLoginShowing()) {
		    if (!studio.getUserName()) {
			wm.logout();
		    } else {
			studio.navGoToLoginPage();
		    }
		}
	    }
	},
	isCloud: function() {
	  return this.isModuleEnabled("cloud", "wm.cloud");
        },
	preloadImages: function() {
		var p = "images/", t = "lib/wm/base/widget/themes/default/images/";
		wm.preloadImage(p + "loadingThrobber.gif");
		wm.preloadImage(p + "properties_16.png");
		wm.preloadImage(p + "inspector_bound.gif");
		wm.preloadImage(p + "project_16t.png");
		wm.preloadImage(p + "colorwheel_16.png");
		wm.preloadImage(p + "lock_16.png");
		wm.preloadImage(p + "group_open.gif");
		wm.preloadImage(p + "star_16.png");
		wm.preloadImage(p + "inspector_bind.gif");
		wm.preloadImage(t + "tree_closed.gif");
	},
	windowUnload: function(e) {
		if (this._isLogout)
			return;
		var 
			u = bundleStudio.MSG_PleaseNoteUnpublishedChanges,
			s = bundleStudio.MSG_PleaseNoteUnsavedChanges,
			m = this.isProjectDirty() ? u : s;
		e.returnValue = m;
		if (!m)
			dojo.publish("wm-unload-app");
		// safari requires value to be returned like this...
		return m;
	},
	initConsole: function() {
		this.console.inFlow = false;
		adaptConsole(this.console.domNode);
		this.reflow();
	},
	//=========================================================================
	// User Settings
	//=========================================================================
	initUserSettings: function() {	  
		this._userSettings = dojo.fromJson(dojo.cookie("wmStudioSettings")) || {};
		if (this._userSettings.location != window.location.href ||
		    this._userSettings.version  != wm.studioConfig.studioVersion)
		  delete this._userSettings.defaultProject;

		var dp = location.hash.slice(1) || wm.defaultProject;		
		if (dp)
			this.setUserSettings({defaultProject: dp});
	},
	setUserSettings: function(inProps) {
		dojo.mixin(this._userSettings, inProps || {});
		this._userSettings.location = window.location.href;
		this._userSettings.version = wm.studioConfig.studioVersion;
		dojo.cookie("wmStudioSettings", dojo.toJson(this._userSettings), { expires: 365 });
	},
	getUserSetting: function(inProp) {
		return (this._userSettings || 0)[inProp];
	},
	//=========================================================================
	// Module Management
	//=========================================================================
	loadModuleConfig: function() {
		loadData(dojo.moduleUrl("wm.modules") + "../modules.js", dojo.hitch(this, "_loadModuleConfig"));
	},
	_loadModuleConfig: function(d) {
		this.moduleConfig = eval("(" + d + ")");
	},
	isModuleEnabled: function(inExtensionPoint, inModuleName) {
		var ep = this.moduleConfig && this.moduleConfig.extensionPoints && this.moduleConfig.extensionPoints[inExtensionPoint];
		if (ep) {
			for (var i = 0, k; (k = ep[i]); i++) {
				if (k == inModuleName)
					return true;
			}
		}
	},
	//=========================================================================
	// Project Related Management
	//=========================================================================
	projectChanging: function() {
		this.clearProjectPages();
		if (this.application) {
			var c = this.application.declaredClass;
			wm.fire(this.application, "destroy");
			this.removeClassCtor(c);
			this.application = null;
		}
		this.clearTrees();
		wm.typeManager.clearTypes();
		wm.services.clear();
		this.updateServices();
		wm.roles = [];
		//
		if (this.project.projectName)
			this.navGotoDesignerClick();
	},
	projectChanged: function(inName, inAppData) {
	        var b = this.application && this.page;
	        if (inName == this.project.projectName) {
		     this.setUserSettings({defaultProject: inName});
		     this.setAppCss(inAppData.css || "");
		    this.setAppScript(inAppData.jscustom || "");
		     this.setCleanApp();
		     this.updateWindowTitle();
		     // open in designer
		     // switch to designer
		     if (b) {
			 studio.startPageDialog.hide();
		       this.navGotoDesignerClick();
		       this.mlpal.activate();
		     } else if (!this.isLoginShowing()) {
			 studio.startPageDialog.show();
			 //this.startLayer.activate();
		       //this.projects.activate();
		     }
    
				// mount project so live services and the resources folder can be accessed; 
				// somewhere there is code so that live services will autodeploy the project, but this doesn't work for resources; 
				// at some point a cleanup of that code may be needed.	        
				if (!wm.studioConfig.preventLiveData && inName != '')
	            	studio.deploy(null,null, true); 
		}
		this.disableMenuBar(!b);
	    //this.disableCanvasSourceBtns(!b);
			    /* Removal of projects tab
		this.updateProjectTree();
		*/

	  if (inName && inName != "") { // if project has closed, don't need to publish
    	if (inName == this.project.projectName) { // if project is changing, first call to this function will have different project name, only publish on second call
		  	dojo.publish("wm-project-changed");
		  }
		}
	},
	pageChanging: function() {
		wm.undo.clear();
		if (!this.page)
			return;
		this.select(null);
		this.setScript("");
		var c = this.page.declaredClass;
		wm.fire(this.page, "destroy");
		this.removeClassCtor(c);
		this.page = null;
		if (this.project.pageName)
			this.navGotoDesignerClick();
	},
	pageChanged: function(inName, inPageData) {
		this.setScript(inPageData.js);
		this.setCss(inPageData.css || "");
		this.cssChanged();
		this.setMarkup(inPageData.html || "");
		this.setCleanPage(inPageData);

	        if (this.page) {
		    this.select(this.page.root);
		    this.refreshDesignTrees();
		}
		dojo.publish("wm-page-changed");
		this.pagesChanged();
	},
	pagesChanged: function() {
		this.updateWindowTitle();
		this.refreshPagePalette();
			    /* Removal of projects tab
		this.updateProjectTreePages();
		*/
	},
	projectsChanged: function() {
			    /* Removal of projects tab
 		this.updateProjectTree();
		*/
	},
	updateWindowTitle: function() {
		var project = studio.application ? studio.application.declaredClass : "";
		var page = studio.page ? studio.page.declaredClass : "";
		var main = studio.application ? studio.application.main : "";
		var title = [];
		if (project)
			title.push(project);
		if (page)
			title.push(page + (page == main ? " (Home)" : ""));
		title.push("WaveMaker Studio");
		window.document.title = title.join(" - ");
	},
	updateServices: function() {
		this.setLiveLayoutReady(false);
		this.servicesService.requestSync("listTypes", [], dojo.hitch(this, "typesChanged"));
		this.servicesService.requestSync("listServicesWithType", [], dojo.hitch(this, "servicesDataChanged"));
	},
	typesChanged: function(inData) {
		wm.typeManager.setTypes(inData.types);
		wm.dataSources.update();
		this.refreshDataPalette();
		dojo.publish("wmtypes-changed");
	},
	servicesDataChanged: function(inData) {
		// clear non-client services from registry
		wm.services.clear();
		// repopulate non-client service registry
		for (var d in inData) {
			wm.services.add({ name: d, type: inData[d] });
		}
		dojo.publish("wmservices-changed");
	},
        getImageLists: function() {
            var obj = studio.page;
            var list = [];
            for (var i in obj.components) {
                if (wm.isInstanceType(obj.components[i], wm.ImageList))
                    list.push(obj.components[i].getId());
            }
            obj = studio.application;
            for (var i in obj.components) {
                if (wm.isInstanceType(obj.components[i], wm.ImageList))
                    list.push(obj.components[i].getId());
            }
            return list;
        },

	refreshPagePalette: function() {
		var 
			palette = studio.palette,
			list = this.project.getPageList(),
			caption = "Page Containers",
			desc = "A page in this project.",
			image ="images/wm/pane.png";
		palette.clearSection(caption);
		for (var i = 0, current = studio.page ? studio.page.declaredClass : "", p; (p = list[i]); i++)
			if (current != p) {
				var n = p.toLowerCase() + "Page", props = { name: n, pageName: p }
				palette.addItem(caption, n, desc, image, "wm.PageContainer", props);
			}
	},
	refreshDataPalette: function() {
		var 
			palette = studio.palette,
			list = wm.dataSources.sources,
			caption = bundlePackage.Database,
			desc = "A data object in this project.",
			image ="images/wm/data.png";
		palette.makeGroup(caption, 6);
		palette.clearSection(caption);
		wm.forEach(list, function(l, i) {
			wm.forEach(l, function(d) {
				var liveDataName = d.caption.toLowerCase();
				var name = liveDataName + "LivePanel1";
				palette.addItem(caption, d.caption + " (" + i + ")", desc, image, "wm.LivePanel", {name: name, liveDataName: liveDataName, liveSource: d.type});
			});
		});
	},
	isLiveLayoutReady: function(inWarn) {
		var r = this._liveLayoutReady;
		if (inWarn && !r) {
		    app.alert("Click the Live Layout button before requesting data.");
		}
		return r;
	},
	setLiveLayoutReady: function(inReady) {
		this._liveLayoutReady = inReady;
	},
    deploySuccess: function() {
			this.setLiveLayoutReady(true);
			this._deploying = false;
			if (this._runRequested) {
			  var isTest = (this._runRequested == "navTestBtn");
			  this._runRequested = false;
			  wm.openUrl(this.getPreviewUrl(isTest), this.project.projectName, "_wmPreview");
                        }
    },
        deploy: function(inMsg, inCallback, noWait) {
           	if (this._deploying) {
		        studio.beginWait(inMsg);
			return;
		}
		this._deploying = true;
		var d = this._deployer = studio.deploymentService.requestAsync("testRunStart");
		d.addErrback(dojo.hitch(this, function(result) {
                    if (result.message && result.message.match(/Application already exists at/)) {
                        this.deploySuccess();
                        return true;
                    } else {
		        if (result.dojoType != "cancel" && (!app.toastDialog.showing || app.toastDialog._toastType != "Warning" && app.toastDialog._toastType != "Error"))
			    app.toastError('Run failed: ' + result.message);
			this._deploying = false;
			this._runRequested = false;
			return result;
                    }
		}));
		if (inCallback)
			d.addCallback(inCallback);
		d.addCallback(dojo.hitch(this, function(result) {
                        this.deploySuccess();
			return result;
		}));
            if (!noWait)
		this.waitForDeferred(d, inMsg);
	},
		 

	//=========================================================================
	// Source control
	//=========================================================================
	getScript: function() {
		return this.editArea.getText();
	},
        setScript: function(inScript) {
	        //this["_cachedEditDataeditArea"] = inScript;
	    this.editArea.setText(inScript);
	},
        getAppScript: function() {
	    return this.appsourceEditor.getText();
	},
        setAppScript: function(inScript) {
	    //this["_cachedEditDataappsourceEditor"] = inScript;
	    this.appsourceEditor.setText(inScript);
	},
	getWidgets: function() {
		return sourcer(this.project.pageName, this.page);
	},
	pageNameChange: function(inOldName, inNewName) {
		this.setScript(this.getScript().replace(new RegExp("\\b" + inOldName + "\\b"), inNewName));
		this.setCss(this.getCss().replace(new RegExp("\\." + inOldName + "\\b", "g"), "." + inNewName));
		this.cssChanged();
		this.page.name = inNewName;
		this.refreshDesignTrees();
	},
	getProjectDesignPath: function() {
		return wm.Component.prototype.getPath();
	},
	designifyCss: function(inCss) {
		var p = this.getProjectDesignPath();
		// if relative paths to images are used in css, prepend the project design path
		// so that the image is resolved at designtime.
		return inCss.replace(/url\s*\(\s*([^(http:)\/].*)\.*\)/g, "url(" + p + "$1)");
	},
	designifyMarkup: function(inMarkup) {
		var p = this.getProjectDesignPath(); ;
		// if relative paths to images are used in html, prepend the project design path
		// so that the image is resolved at designtime.
		return inMarkup.replace(/<img([^>]*)src[^>]*=[^>]*(["'])([^(http:)\/][^>]*)\2/g, '<img$1src="' + p + '$3"');
	},
	getCss: function() {
		return this.cssEditArea.getText();
	},
	getAppCss: function() {
		return this.appCssEditArea.getText();
	},
	setCss: function(inCss) {
	    //this["_cachedEditDatacssEditArea"] = inCss;
		this.cssEditArea.setText(inCss);
		this.cssChanged();
	},
	setAppCss: function(inCss) {
	    //this["_cachedEditDataappCssEditArea"] = inCss;
		this.appCssEditArea.setText(inCss);
		this.cssChanged();
	},
	cssChanged: function() {
		setCss("page_ss", this.designifyCss(this.getCss()));
		setCss("app_ss", this.designifyCss(this.getAppCss()));
		this.reflow();
	},
	getMarkup: function() {
		return this.markupEditArea.getText();
	},
	setMarkup: function(inScript) {
	    //this["_cachedEditDatamarkupEditArea"] = inScript;
		this.markupEditArea.setText(inScript);
		this.markupChanged();
	},
	markupChanged: function() {
		studio.markup.domNode.innerHTML = this.designifyMarkup(this.getMarkup());
		// re-inspect selected control since markup change may influence inspector
	        inspect(this.selected || this.root);
		dojo.publish("wm-markupchanged");
	},
	//=========================================================================
	// Control Management
	//=========================================================================
	makeName: function(inType) {
		var n = inType.replace("wm.", "").replace("dijit.", "").replace("wm.", "");
		n = n.substring(0, 1).toLowerCase() + n.substring(1);
		// default name includes trailing 1
		return n.replace(/\./g, "") + "1";
	},
	findContainer: function(inControl, inType) {
		// identify selected container
		var c = inControl
		while (c && !(c.container && c.isWidgetTypeAllowed(inType) && !c.getFreeze())) { c = c.parent };
		return c;
	},
	newComponent: function(inType, inProps) {
		var tree = this.componentsTree;
		// FIXME: redundant
		var ctor = dojo.getObject(inType), p = (ctor || 0).prototype;
		var s = tree.selected || 0, c = s.component || 0, owner = c.owner || s.owner || this.page;
		return owner.createComponent(this.makeName(inType, owner), inType, inProps);
	},
	_newWidget: function(inType, inProps, inParent) {
		inProps = inProps || {};
		var n = inProps.name || inType;
		var c = this.page.loadComponent(this.makeName(n), inParent, inType, inProps);
		//this.page.reflow();
		return c;
	},
	newWidget: function(inType, inProps) {
		var p = this.findContainer(this.selected, inType) || studio.page.root.findContainer(inType);
		if (p)
			return this._newWidget(inType, inProps, p);
		else
		    app.alert("No available container for the new widget.  All containers are either locked or frozen.");
	},
	_marshall: function(inType) {
		return dojo.getObject(inType) || dojo.declare(inType, wm.Label, { caption: inType });
	},
	_make: function(inType, inProps) {
		inProps = inProps || {};
		var ctor = this._marshall(inType);
		if (ctor) {
			var isWidget = ctor.prototype instanceof wm.Widget || ctor.prototype instanceof dijit._Widget;
			// flag for behavior to occur only upon initial creation
			inProps._studioCreating = true;
			var c = isWidget ? this.newWidget(inType, inProps) : this.newComponent(inType, inProps);
			if (c)
				c._studioCreating = false;
			return c;
		}
	},
	_add: function(inComponent) {
		if (!inComponent)
			return;
		new wm.AddTask(inComponent);
		if (!(inComponent instanceof wm.Widget))
			this.addComponentToTree(inComponent);
		this.inspector.resetInspector();
		// NOTE: Addresses Russian Doll syndrome. Don't select panels by default.
		if (!(inComponent instanceof wm.Container)) {
			this.select(inComponent);
		}
		this.page.reflow();
		return inComponent;
	},
	make: function(inType, inProps) {
		return this._add(this._make(inType, inProps));
	},
        _lastBindSelect: null,
	select: function(inComponent) {
	        if (studio.bindDialog && studio.bindDialog.showing && !studio.bindDialog._hideAnimation) {
/*
		    if (this._lastBindSelect == inComponent) {
			var propList = inComponent.listDataProperties("bindTarget");
			var randProp;
			for (var i in propList) {
			    randProp = i;
			    break;
			}
			this.bindDialog.page.update({object: inComponent, targetProperty: randProp});
			this.bindDialog.page.binderSource.searchBar.setDataValue("");
			this._lastBindSelect = null;
		    } else {
		    */
		    this.bindDialog.page.binderSource.searchBar.setDataValue("#" + inComponent.name);
			this._lastBindSelect = inComponent;
/*		    }*/
		    return;
		}

	    // if there is a bindSelect, then set selected to null so that we can force a reselect
	    if (this._lastBindSelect) {
                this._lastBindSelect = null;
		this.selected = null;
	    }
		if (this.selected == inComponent)
			return;
 
	    // if its a dialog or a widget within a dialog dismiss the dialog
	    // unless the new selection IS in the dialog as wel
            if (this.selected && !this.selected.isDestroyed && this.selected instanceof wm.Control) {
		var dialog1 = this.selected.getParentDialog();
		var dialog2 = (inComponent instanceof wm.Control) ? inComponent.getParentDialog() : null;
		if (dialog1 && dialog1 != dialog2)
		    dialog1.dismiss();
	    }

		while (inComponent && inComponent.isParentLocked && inComponent.isParentLocked())
			inComponent = inComponent.parent;

	    if (inComponent) {
		if (this.treeSearch.getDataValue()) {
		    this.treeSearch.setDataValue("");
		    this.refreshVisualTree();
		}
		if (this.compTreeSearch.getDataValue()) {
		    this.compTreeSearch.setDataValue("");
		    this.refreshServiceTree();
		    this.refreshComponentTree();
		}
	    }
		try {
			var s = this.selected = inComponent;
			// make sure selected widget and all ancestors are showing
			this.revealSelected();
			// select in designer
			this.designer.select(s instanceof wm.Widget ? s : null);
			// select component on appropriate tree
			if (s) {
			    if (!s._studioTreeNode || s._studioTreeNode.tree != this.tree)
				this.tree.deselect();
			    if (!s._studioTreeNode || s._studioTreeNode.tree != this.widgetsTree)
				this.widgetsTree.deselect();
			    if (!s._studioTreeNode || s._studioTreeNode.tree != this.compTree)
				this.compTree.deselect();
			}
			this.selectInTree(s);
			// show in inspector
			if (s && !s.noInspector)
				inspect(s, true);
		} finally {
		}
		this.updateCutPasteUi();
		this.updateStatus();
	},
	revealSelected: function() {
		// if the widget is on an inactive layer,
		// activate all parent layers so it's visible
		var w = this.selected;
		if (w instanceof wm.Widget)
			while (w) {
			wm.fire(w, "activate");
			w = w.parent;
		}
	},
	selectParent: function() {
		if (this.targetMode) 
			this.selectProperty()
		else
			this.designer.selectParent();
	},
        treeSearchChange: function(inSender) {
	    var newval = this.treeSearch.getDataValue();
	    this.refreshVisualTree(newval);
	},
        compTreeSearchChange: function(inSender) {
	    var newval = this.compTreeSearch.getDataValue();
	    this.refreshServiceTree(newval);
	    this.refreshComponentTree(newval);
	},
    resetTreeSearch: function() {
	    this.treeSearch.setDataValue("");
    },
    resetCompTreeSearch: function() {
	    this.compTreeSearch.setDataValue("");
    },
        paletteSearchChange: function(inSender) {
	    var newval = this.paletteSearch.getDataValue();
	    this.palette.filterNodes(new RegExp(newval ? newval.toLowerCase() : ""));
	},
    resetPaletteSearch: function() {
	    this.paletteSearch.setDataValue("");
    },
        projectsSearchChange: function(inSender) {
	    var newval = this.projectsSearch.getDataValue() || "";
	    var regex = new RegExp(newval.toLowerCase());
	    var projectNodes = this.projectsTree.root.kids;
	    for (var i = 0; i <  projectNodes.length; i++) {
		projectNodes[i].domNode.style.display =  (projectNodes[i].content.toLowerCase().match(regex)) ? "block" : "none";
	    }
	},
    resetProjectsSearch: function() {
	    this.projectsSearch.setDataValue("");
    },

        keyboardShortcutsDialog: function() {
	    var shortcuts = [
		             {d: "Most common shortcuts"},
			     {l: "C-w", d: "Toggle width between 100% and 100px (not supported for chrome in windows)"},
			     {l: "C-h", d: "Toggle height between 100% and 100px"},
			     {l: "C-m", d: "Toggle between model and palette"},
			     {l: "C-s", d: "Save project"},
			     {l: "C-r", d: "Run project"},
			     {l: "ESC", d: "If dialog is open: Close the dialog"},
			     {l: "ESC", d: "If no dialog: Select the parent of the selected widget"},
			     {l: "DEL", d: "Delete selected component (unless a text field/property field is selected for editting in which case it edits the text field)"},

		             {d: "Additional shortcuts"},		
			     {l: "C-o", d: "Toggle horizontal alignment of widgets in container"},
			     {l: "C-e", d: "toggle vertical alignment of widgets in container"},
			     {l: "C-b", d: "Toggle layoutKind between left-to-right and top-to-bottom"},
		             {l: "C-z", d: "Undo"}];

	    var html = "<table>";
	    for (var i = 0; i < shortcuts.length; i++) {
		if (!shortcuts[i].l) {
		    html += "<tr><td colspan='2'><b>" + shortcuts[i].d + "</td></tr>\n";
		} else {
		    html += "<tr><td style='white-space: nowrap;'>" + shortcuts[i].l + "</td><td>" + shortcuts[i].d + "</td></tr>\n";
		}
	    }
	    html += "</table>";
	    html = "<div class='KeyboardShortcutDialog'>" + html + "</div>";
	    this.helpDialog.setUserPrompt(html);
	    this.helpDialog.show();
	    
	},
	componentRenamed: function(inOld, inNew, inComponent) {
		this.renameComponentOnTree.apply(this, arguments);
		_setInspectedCaption(inComponent);
		this.cssChanged();
	},
	//=========================================================================
	// UI
	//=========================================================================
	waitForDeferred: function(inDeferred, inMsg) {
		this.beginWait(inMsg);
		inDeferred.addBoth(dojo.hitch(this, function(inResult) {
			this.endWait(inMsg);
			return inResult;
		}));
	},
	waitForCallback: function(inMsg, inCallback) {
		studio.beginWait(inMsg);
		wm.onidle(function() {
			try {
				inCallback();
			}
			catch(e){
				console.info('error while waitForCallback: ', e);
			}

			studio.endWait(inMsg);
		});
	},
        waitMsg: null,
	beginWait: function(inMsg, inNoThrobber) {
	        if (!this.waitMsg) this.waitMsg = {};
		if (!inMsg)
			return;
		this.dialog.setWidth("242px");
		this.dialog.setHeight("115px");
		this.dialog.containerNode.innerHTML = [
			'<table class="wmWaitDialog"><tr><td>',
				inNoThrobber ? '' : '<div class="wmWaitThrobber">&nbsp;</div>',
				'<div class="wmWaitMessage">',
				inMsg || 'Please wait...',
				'</div>',
				'<br />',
			'</td></tr></table>',
		''].join('');
		this.dialog.setShowing(true);
                this.waitMsg[inMsg] = 1;
	},
	endWait: function(optionalMsg) {
	        if (optionalMsg)
                   delete this.waitMsg[optionalMsg];
                else
                   this.waitMsg = {};

                var firstMsg = "";
                for (var msg in this.waitMsg) {
                   firstMsg = msg;
                   break;
                }
	        if (firstMsg) 
		   this.beginWait(firstMsg);
                else
		   this.dialog.setShowing(false);
	},
	addStudioClass: function(inClass) {
		var n = this.designer.domNode;
                /* This is just terribly wrong.... what does it mean?  MK */
		if (dojo.hasClass(n, inClass))
			dojo.addClass(n, inClass);
	},
	removeStudioClass: function(inClass) {
		dojo.removeClass(this.designer.domNode, inClass);
	},
	toggleStudioClass: function(inClass) {
		var n = this.designer.domNode;
		dojo[dojo.hasClass(n, inClass) ? "removeClass" : "addClass"](n, inClass);
	},
	statusMsg: "",
	setStatusMsg: function(inMsg) {
		this.statusMsg = inMsg;
		this.updateStatus();
	},
	updateStatus: function() {
	    return;
		var s = this.selected, m = [s ? s.name : '(no selection)'];
		if (s && s instanceof wm.Widget) {
			var b = s.getBounds();
			m.push(Math.round(b.w) + ' x ' + Math.round(b.h));
		}
		var h = [
			'<table cellspacing="0" style="height: 100%; width: 100%; text-align: center;"><tr>',
			'<td class="statusNameBox" style="font-weight: bold; width:14em; border-right: 1px solid silver; padding: 2px;">',
				m[0],
			'</td>',
			'<td class="statusSizeBox"  style="width:8em; border-right: 1px solid silver; padding: 2px;">',
				m[1],
			'</td>',
			'<td class="statusMsgBox" style="padding: 2px;">',
				this.statusMsg,
			'</td>',
			'<td class="statusLoadingBox" style="width: 32px; border-left: 1px solid silver; padding: 2px">',
					wm.inflight.getCount() ? '<img src="images/loadingThrobber.gif"/>' : '&nbsp;',
			'</td>',
			'</tr></table>'].join('');
		if (this._lastStatus != h) {
			this.status.domNode.innerHTML = h;
			this._lastStatus = h;
		}
	},
	isShowingWorkspace: function() {
		return (this.tabs.getLayer().name == "workspace");
	},
	//=========================================================================
	// Events
	//=========================================================================
	allowKeyTarget: function(e) {
		// prevent trapping keypress in native key-aware controls
		var ctrls = { "INPUT": 1, "TEXTAREA": 1 };
		var t = e.target;
		while (t) {
			if (ctrls[t.tagName])
				return true;
			t = t.parentNode;
		}
		return false;
	},
	processKey: function(inCode, inMap, inCanProcess) {
		for (var i = 0, k; (k = inMap[i]); i++) {
			if (k.key == inCode && (inCanProcess || k.always)) {
				if (this[k.action]) {
					if (k.idleDelay)
						wm.onidle(this, k.action);
					else
						this[k.action]();
				}
				return true;
			}
		}
	},
	keydown: function(e) {
	    // return if there are any showing dialogs owned by StudioApplication; dialogs intercept ESC and other keyboard
	    // events using their own event handlers
	    if (dojo.some(wm.dialog.showingList, dojo.hitch(this,function(dialog) {return dialog.getOwnerApp() == this.owner;})))
		return true;

	    if (e._wmstop)
		return true;
	    

		// only act on CTRL keys (but not SHIFT-CTRL)
		var 
			hotkey = (e.ctrlKey && !(e.ctrlKey && e.shiftKey)),
			kc = e.keyCode,
                        isEsc = kc == dojo.keys.ESCAPE,
			chr = String.fromCharCode(kc),
			normalKey = ((!this.studioKeyPriority && this.allowKeyTarget(e)) || !this.isShowingWorkspace() || wm.dialog.showing),
			handled = false;               
		// hotkey
		if (hotkey)
			handled = this.processKey(chr, wm.studioConfig.hotkeyMap, !normalKey);

                // if its not a hotkey, and the target is a text or password field, let the browser handle it
                if (!hotkey && !isEsc) {
	            if (e.target && e.target.nodeName.toLowerCase() == "input" && (dojo.attr(e.target, "type") == "text" || dojo.attr(e.target, "type") == "password"))
                        return;
                }

		// key codes
		if (!handled)
			handled = this.processKey(kc, wm.studioConfig.hotkeyCodeMap, !normalKey);
		// if we've handled the key, stop the event
		if (handled)
			dojo.stopEvent(e);
	},
        // Support keypress event that should do nothing and NOT bubble up to the window level
        nullAction: function() { 
	    ;
	},
	/*topLayersChange: function(inSender) {
		if (inSender.getLayerCaption() == "Welcome")
			wm.fire(this.welcomePane.page, "update");
	},*/
	tabsCanChange: function(inSender, inChangeInfo) {
	    switch (inSender.getLayerCaption().replace(/^\<.*?\>\s*/,"")) {
			case bundleStudio.R_IDE:
				setTimeout(dojo.hitch(this, function() {
					this.cssChanged();
					this.markupChanged();
				}), 100);
				break;
		}
		switch (inSender.getLayerCaption(inChangeInfo.newIndex).replace(/^\<.*?\>\s*/,"")) {
			case bundleStudio.R_IDE:
				this.widgetsHtml.setHtml('<pre style="padding: 0; width: 100%; height: 100%;">' + this.getWidgets() + "</pre>");
		                var appsrc = this.project.generateApplicationSource();
		                var match = appsrc.split(terminus)
		               
		    appsrc = (match) ? match[0] + "\n\t" + terminus + "\n});" : appsrc;
		                this.appsourceHtml.setHtml('<pre style="padding: 0; width: 100%; height: 100%;">' + appsrc + "</pre>");
				break;
		}
	},
	tabsChange: function(inSender) {
	    if (!studio.page) return;
	    
		var caption = inSender.getLayerCaption().replace(/^\<.*?\>\s*/,"");

		switch (caption) {
			case bundleStudio.R_IDE:
		                this.designer.showHideHandles(false);
				this.sourceTabsChange(this.sourceTabs);
				break;
			case bundleStudio.T_Design:
		                this.designer.showHideHandles(true);
				// re-inspect when we show designer
				if (this.selected) {
                                    // selected object may have changed; example: 
                                    // in liveview, I hit delete, now live view is no longer selected AND 
                                    // we change tabs going back to the canvas.
                                    if (this.selected == this.inspector.inspected)
					this.inspector.reinspect();
                                    else
                                        this.inspector.inspect(this.selected);
				}
				break;
		}
	},
	leftTabsChange: function(inSender) {
		var caption = inSender.getLayerCaption();
		if (caption == bundleStudio.Palette && this.page)
			this.navGotoDesignerClick();
	},
	objectTabsChange: function(inSender) {
		var 
			l = inSender.getLayerCaption(),
			tree = l == "Widgets" ? this.tree : (l == "Components" ? this.componentsTree : null),
			ss = this.selected,
			s = tree && tree.selected,
			c = s && s.component;
		if (tree && c && c != ss)
			this.select(c);
	},
	sourceTabsCanChange: function(inSender, inChangeInfo) {
	},
	sourceTabsChange: function(inSender) {
		var caption = inSender.getLayerCaption().replace(/^\<.*?\>\s*/,"");

            // darksnazzy messes with users ability to edit themes
                dojo[(caption == bundleStudio.R_Themes) ? "removeClass" : "addClass"](this.sourceTab.domNode, "wm-darksnazzy");
		if (caption == bundleStudio.R_Diagnostics) {
			this.diagnosticsPane.page.update();
		} else if (caption == bundleStudio.R_ServerLogs) {
		    this.logViewer.page.showLogs();

                } else if (caption == bundleStudio.R_App_Docs) {
		    this.generateAllDocumentation();

		}

	},

        generateAllDocumentation: function() {
	    
	    var html = "<i>Note: this page is for reviewing documentation; to edit documentation you must go to the component in the model and select its documentation property</i>";
	    var c;

	    html += "<h2>App " + studio.application.name + "</h2>";
	    for (c in studio.application.components) {
		var comp = studio.application.components[c];
		if (comp.documentation || comp instanceof wm.Control == false)
		    html += "<hr/><h3>" + comp.name + " (" + comp.declaredClass + ")</h3><div style='padding-left: 15px'>" + (comp.documentation || "No Documentation") + "</div>";
	    }	    


	    html += "<h2>Page " + studio.project.pageName + " Non-Visual Components</h2>";
	    for (c in studio.page.components) {
		var comp = studio.page.components[c];
		if (comp.documentation || comp instanceof wm.Control == false)
		html += "<hr/><h3>" + comp.name + " (" + comp.declaredClass + ")</h3><div style='padding-left: 15px'>" + (comp.documentation || "No Documentation") + "</div>";
	    }

	    html += "<h2>Page " + studio.project.pageName + " Non-Visual Components</h2>";
	    var widgets = wm.listOfWidgetType(wm.Control, false, true);
	    for (var i = 0; i < widgets.length; i++) {
		var comp = widgets[i];
		if (comp.documentation) 
		    html += "<hr/><h3>" + comp.name + " (" + comp.declaredClass + ")</h3><div style='padding-left: 15px'>" + comp.documentation  + "</div>";
	    }
	    this.appDocViewer.setHtml(html);
	},
        printAppDocsClick: function(inSender) {
	    var win = window.open("", "APIPrintout", "width=800,height=500");
	    var doc = win.document.open("text/html");
	    doc.write(this.appDocViewer.html);
	    doc.write("<script>window.setTimeout(function() {window.print();}, 100);</script>");
	    doc.close();	    
	},
    showLicenseDialogClick: function() {
	this.startPageDialog.show();
	this.startPageDialog.page.licenseLayer.activate();
	this.startPageDialog.page.licensePage.page.closeButton.show();
    },
	treeSelect: function(inSender, inNode) {
		this.treeNodeSelect(inNode);
		//this.select(inNode.component);
	},
	inflightChange: function() {
		this.updateStatus();
	    if (wm.inflight.getCount())
		this.setStatusMsg("Pending Request: " + wm.Array.last(wm.inflight._inflightNames));
	    else
		this.setStatusMsg("");
		//this.setStatusMsg("Pending Requests: " + wm.inflight.getCount());
	},
	//=========================================================================
	// Clicks
	//=========================================================================
	toggleControlSize: function(inControl, inDimension) {
            if (!inControl.canResize(inDimension)) return;
	    var d = String(inControl.getProp(inDimension));
            if (d.indexOf("%") >= 0) {
                d = Math.max(parseInt(d), inControl["getMin" + wm.capitalize(inDimension) + "Prop"]()) + "px";
            } else {
                d = "100%";
            }
	    inControl.setProp(inDimension, d);
	},
	toggleControlPosition: function(inControl, inProp, inValues) {
		var
			v = inControl.getValue(inProp),
			i = (dojo.indexOf(inValues, v)+1) % inValues.length;
		inControl.setValue(inProp, inValues[i]);
	},
	toggleWidthClick: function() {
		var s = this.selected;
		if (s) {
			this.toggleControlSize(s, "width");
			inspect(s);
		}
	},
	toggleHeightClick: function() {
		var s = this.selected;
		if (s) {
			this.toggleControlSize(s, "height");
			inspect(s);
		}
	},
	toggleFlexBcClick: function() {
		var s = this.selected;
		if (s) {
			var pBox = s.parent && s.parent.layoutKind;
			this.toggleControlSize(s, pBox == "top-to-bottom" ? "height" : "width");
		}
	},
	toggleVerticalAlignClick: function() {
		var s = this.selected;
		if (s) {
			this.toggleControlPosition(s, "verticalAlign", ["top", "middle", "bottom"]);
			inspect(s);
		}
	},
	toggleHorizontalAlignClick: function() {
		var s = this.selected;
		if (s) {
			this.toggleControlPosition(s, "horizontalAlign", ["left", "center", "right"]);
			inspect(s);
		}
	},
	toggleLayoutClick: function() {
		var s = this.selected;
		if (s) {
			var v = "top-to-bottom", h = "left-to-right";
			s.setLayoutKind(s.layoutKind == v ? h : v);
			inspect(s);
		}
	},
	outlinedClick: function() {
		this.removeStudioClass(this._explodeClass);
		this.toggleStudioClass(this._outlineClass);

		var on = dojo.hasClass(this.designer.domNode, this._outlineClass);
		this.useDesignBorder = on;
		if (studio.page) {
			wm.forEachWidget(studio.page.root, function(w) {
			    if (w.owner == studio.page) {
				    //w.designWrapper.setBorder(on ? "1" : "0");
                                w.getDesignBorder();
                                w.invalidCss = true;
                                w.renderCss();
                            }
			});
		}
		wm.fire(this.page, "reflow");

	},
	explodedClick: function() {
		this.addStudioClass(this._outlineClass);
		this.toggleStudioClass(this._explodeClass);
		this.reflow();
		// update user setting
		this.setUserSettings({ explode: dojo.hasClass(this.designer.domNode, this._explodeClass) });
	},
	// a UI action concept would be handy for all this stuff
	updateCutPasteUi: function() {
		var 
			klass = this.clipboardClass,
			needsLayer = (klass == "wm.Layer"),
			disabled = !this.clipboard;
		if (!disabled && needsLayer) {
			var rp = dojo.getObject(wm.getClassProp(klass, "_requiredParent"));
			disabled = rp && !(this.selected instanceof rp);
		}
		this.pasteBtn.setDisabled(disabled);
	},
	copyClick: function() {
		if (!this.copyBtn.disabled)
			this.copyControl();
	},
	cutClick: function() {
		if (!this.cutBtn.disabled)
			this.cutControl();
	},
	pasteClick: function() {
		if (!this.pasteBtn.disabled)
			this.pasteControl();
	},
	deleteClick: function() {
		if (!this.deleteBtn.disabled)
			this.deleteControl();
	},
	undoClick: function() {
		wm.undo.pop();
	},
	newComponentButtonClick: function(inSender) {
		var t = inSender.componentType;
		if (t) {
			this.make(t);
			wm.fire(this.selected, "showConfigureDialog");
		}
	},
	componentsTreeDblClick: function(inSender, inNode) {
		var c = inNode.component;
		if (c.showConfigureDialog)
			c.showConfigureDialog();
	},
	deleteComponentButtonClick: function() {
		var s = this.componentsTree.selected;
		if (s && s.component)
			this.deleteControl(s.component);
	},
	linkButtonClick: function(inSender, inData) {
		if (inData.openLink)
			wm.openUrl(inSender.openLink, inSender.openLinkTitle);
	},

    /* Theme toolbar buttons */
    saveThemeClick: function(inSender) {
	this.themesPage.page.saveTheme(inSender);
    },
    addNewThemeClick: function(inSender) {
	this.themesPage.page.copyThemeClick(inSender, "wm_default");
    },
    copyThemeClick: function(inSender) {
	this.themesPage.page.copyThemeClick(inSender);
    },
    deleteThemeClick: function(inSender) {
	this.themesPage.page.removeThemeClick(inSender);
    },
    revertThemeClick: function(inSender) {
	this.themesPage.page.revertTheme();
    },
    pageSelectChanged: function(inSender, optionalPageName) {
	if (!studio.page) return;
	var page = optionalPageName || inSender.getDataValue();
	if (page == this.project.pageName) return;
	var warnPage = bundleDialog.M_AreYouSureOpenPage;
        this.confirmPageChange(warnPage, page, dojo.hitch(this, function() {
	    this.waitForCallback(bundleDialog.M_OpeningPage + page + ".", dojo.hitch(this.project, "openPage", page));
        }));
	this.project.openPage(pagename);
    },

	selectProperty: function(inSender, info, text) {
		console.log("selectProperty");
		var n = this._testn;
		if (this.targetMode) {
			n.style.display = "none";
			this.targetMode = false;
			this.inspector.setSelectMode(false);
			dojo.disconnect(this._testc);
		} else {
			this._bindTarget = inSender;
			if (!n) {
				n = this._testn = document.createElement("div");
				n.innerHTML = text; //"select target";
				n.style.cssText = "background-color: lightgreen; border: 1px solid black; position: absolute; padding: 4px;";
				document.body.appendChild(n);
			}
			n.style.display = "";
			this._testc = dojo.connect(document.body, "onmousemove", this, function(e) {
				n.style.left = e.pageX + 16 + "px";
				n.style.top = e.pageY + 16 + "px";
			});
			this.inspector.setSelectMode(true);
			this.targetMode = true;
		}
	},
	propertySelected: function(inId) {
		this.onSelectProperty(inId);
		// shuts down select mode
		this.selectProperty();
		// bindBind may have been performed by a different inspector
		this.select(this._bindTarget);
	},
	onSelectProperty: function(inId) {
	},
	//=========================================================================
	// Designer Events
	//=========================================================================
	designerSelect: function(inSender, inControl) {
		if (inControl) {
			this.select(inControl);
		}
	},
	designerMove: function(inSender, inDragger) {
		//this.updateStatus();
		studio.refreshDesignTrees();
	},
	//=========================================================================
	// Cloud User Management
	//=========================================================================
	requestUserName: function() {
		studio.securityService.requestSync("getUserName", [], dojo.hitch(this, "requestUserNameSuccess"), dojo.hitch(this, "requestUserNameFailure"));
	},
        setUserName: function(inName) {
	    this.userName = inName;
            this.userLabel.setCaption(this.userName);
        },
	requestUserNameSuccess: function(inResponse) {
		if (inResponse) {
		    this.setUserName(inResponse);
		    this.userLabel.setCaption(this.userName);
                        this.projectPrefix = this.userName;
                        this.projectPrefix = this.projectPrefix.replace(/_/g,"__");
                        this.projectPrefix = this.projectPrefix.replace(/\@/,"_AT_");
                        this.projectPrefix = this.projectPrefix.replace(/\./g,"_DOT_");
                        this.projectPrefix += "___";
                }
	},
	requestUserNameFailure: function(inResponse) {
                this.getProjectDir("");
	},
        getUserName: function() {return this.userName;},
        editAccountClick: function(inSender) {
	    app.pageDialog.showPage("UserSettings",true, 500,200);        
        },
	logoutClick: function(inSender) {
	    this.confirmAppChange('Are you sure you want to logout? Unsaved changes will be lost.', undefined, 
                                  dojo.hitch(this, function() {
		                      this._isLogout = true;
		                      studio.securityService.requestSync("logout", [], dojo.hitch(this, "logoutSuccess"));
                                  }));
	},
	logoutSuccess: function(inResponse) {
		window.location.reload();
	},
        saveDocumentation: function() {
	    var html = this.documentationDialog.getHtml();	   
	    this.documentationDialog.editComponent.documentation = html;
	    if (this.documentationDialog.editComponent == studio.selected)
		this.inspector.reinspect();
	},
        loadThemeList: function(optionalCallback) {
            var d = studio.deploymentService.requestAsync("listThemes");
            d.addCallback(dojo.hitch(this, function(inData) {
                var d = [];
                for (var i = 0; i < inData.length; i++) 
                    if (inData[i] != "wm_studio")
                        d.push({dataValue: inData[i]});
                this.themesListVar.setData(d);
            }));
            if (optionalCallback)
                d.addCallback(optionalCallback);
        },
    loadHelp: function(inType, inPropName, onSuccess) {
	      inType = inType.substring(inType.indexOf(".")+1);


	      if (inType.indexOf("gadget.") == 0)
		  inType = inType.substring(inType.indexOf(".")+1);

	      if (inType.indexOf("dijit.") == 0)
		  inType = inType.substring(inType.indexOf(".")+1);


	      inType = inType.replace(/\./g, "_");

	studio.studioService.requestAsync("getPropertyHelp", [inType + "_" + inPropName + "?synopsis"], onSuccess);
    },
    startPageIFrameLoaded: function() {
	this.startPageDialog.page.iframe.show();
    },
    menuBarHelpClick: function() {
	window.open("http://dev.wavemaker.com/wiki/bin/wmdoc/");
    },
/*
    mouseOverMenuBarHelp: function(inSender) {
	app.createToolTip("Click for documentation", this.menuBarHelp.domNode, null, "150px");
    },
    mouseOutMenuBarHelp: function(inSender) {
	app.hideToolTip();
    },
    */
    loadResourcesTab: function() {
	this.resourcesPage.getComponent("resourceManager").loadResources();
    },

    toggleInspectorDialog: function() {
	if (this.PIContents.parent == this.PIPanel) {
	    this.PIContents.setParent(this.propertiesDialog.containerWidget);
	    this.splitter3b.hide();
	    this.PIPanel.hide();
	    this.inspectorDialogToggle.hide();
	    this.PIBotBorder.hide();
	    this.propertiesDialog.titleClose.show();
	    this.propertiesDialog.show();
	} else {
	    this.propertiesDialog.hide();
	    this.PIContents.setParent(this.PIPanel);
	    this.inspectorDialogToggle.show();
	    this.PIBotBorder.show();
	    this.PIPanel.show();
	    this.splitter3b.show();
	    this.PIPanel.reflow();
	}
    },

    togglePaletteDialog: function() {
	if (this.left.parent == this.panel2) {
	    this.paletteDialog.containerWidget.setPadding("0");
	    this.left.setParent(this.paletteDialog.containerWidget);
	    this.splitter1.hide();
	    this.panel2.hide();
	    this._paletteToDialogButton.style.display = "none";
	    this.paletteDialog.titleClose.show();
	    this.paletteDialog.show();
	} else {
	    this.paletteDialog.hide();
	    this.left.setParent(this.panel2);
	    this._paletteToDialogButton.style.display = "";
	    this.panel2.show();
	    this.splitter1.show();
	    this.panel2.reflow();
	}
    }

});
