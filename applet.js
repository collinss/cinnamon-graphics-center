const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GMenu = imports.gi.GMenu;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Util = imports.misc.util;
const Lang = imports.lang;

const UUID = "graphicsCenter@scollins"
const MENU_ITEM_TEXT_LENGTH = 25;
const MENU_PADDING_WIDTH = 25;

let menu_item_icon_size;


function MenuItem(title, icon){
    this._init(title, icon);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(title, icon, params){
        try{
            
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            this.addActor(icon);
            
            if ( title.length > MENU_ITEM_TEXT_LENGTH ) {
                let tooltip = new Tooltips.Tooltip(this.actor, title);
                title = title.slice(0,MENU_ITEM_TEXT_LENGTH-3) + "...";
            }
            let label = new St.Label({ text: title });
            this.addActor(label);
            this.actor._delegate = this;
            
        } catch (e){
            global.logError(e);
        }
    }
}


function LauncherMenuItem(menu, app) {
    this._init(menu, app);
}

LauncherMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(menu, app) {
        try {
            
            this.menu = menu;
            this.app = app;
            
            let title = app.get_name();
            let icon = app.create_icon_texture(menu_item_icon_size);
            MenuItem.prototype._init.call(this, title, icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    activate: function() {
        try {
            
            this.menu.close();
            this.app.open_new_window(-1);
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function PictureMenuItem(menu, file) {
    this._init(menu, file);
}

PictureMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(menu, file, params) {
        try {
            
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            this.menu = menu;
            let fileInfo = file.query_info("*", Gio.FileQueryInfoFlags.NONE, null);
            this.uri = file.get_uri();
            
            let image = St.TextureCache.get_default().load_uri_async(this.uri, 120, 100);
            this.addActor(image);
            
            let tooltip = new Tooltips.Tooltip(this.actor, fileInfo.get_name());
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    activate: function(event) {
        try {
            
            this.menu.close();
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function RecentMenuItem(menu, title, iName, file) {
    this._init(menu, title, iName, file);
}

RecentMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(menu, title, iName, file) {
        try {
            
            this.menu = menu;
            this.file = file;
            
            let icon = new St.Icon({icon_name: iName, icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
            MenuItem.prototype._init.call(this, title, icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    activate: function(event) {
        try {
            
            this.menu.close();
            Gio.app_info_launch_default_for_uri(this.file, global.create_app_launch_context());
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function ClearRecentMenuItem(menu, recentManager) {
    this._init(menu, recentManager);
}

ClearRecentMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(menu, recentManager) {
        try {
            
            this.menu = menu;
            this.recentManager = recentManager;
            
            let icon = new St.Icon({icon_name: "edit-clear", icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
            MenuItem.prototype._init.call(this, _("Clear"), icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    activate: function(event) {
        try {
            
            this.menu.close();
            this.recentManager.purge_items();
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function MyApplet(orientation, panel_height, instanceId) {
    this._init(orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
    
    _init: function(orientation, panel_height, instanceId) {
        try {
            
            this.orientation = orientation;
            Applet.TextIconApplet.prototype._init.call(this, this.orientation, panel_height);
            
            this._bind_settings(instanceId);
            
            //set up panel
            this._set_panel_icon();
            this._set_panel_text();
            this.set_applet_tooltip(_("Office"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.appSys = Cinnamon.AppSystem.get_default();
            let dirMonitor = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES))
                                .monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, null);
            this.recentManager = new Gtk.RecentManager();
            
            //listen for changes
            this.appSys.connect("installed-changed", Lang.bind(this, this._build_launchers_section));
            dirMonitor.connect("changed", Lang.bind(this, this._build_pictures_section));
            this.recentManager.connect("changed", Lang.bind(this, this._build_recent_documents_section));
            
            this.build_menu();
            
        } catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    
    _bind_settings: function(instanceId) {
        
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelIcon", "panelIcon", this._set_panel_icon);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelText", "panelText", this._set_panel_text);
        this.settings.bindProperty(Settings.BindingDirection.IN, "iconSize", "iconSize", this.build_menu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showPictures", "showPictures", this.build_menu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "altDir", "altDir", this._build_pictures_section);
        this.settings.bindProperty(Settings.BindingDirection.IN, "recursePictures", "recursePictures", this._build_pictures_section);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showRecentDocuments", "showRecentDocuments", this.build_menu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "recentSizeLimit", "recentSizeLimit", this._build_recent_documents_section);
        
    },
    
    build_menu: function() {
        try {
            
            if ( this.menu ) this.menu.destroy();
            
            menu_item_icon_size = this.iconSize;
            
            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menuManager.addMenu(this.menu);
            let section = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(section);
            let mainBox = new St.BoxLayout({ style_class: 'menu-applications-box', vertical: false });
            section.actor.add_actor(mainBox);
            
            //launchers section
            let launchersPane = new PopupMenu.PopupMenuSection();
            let title = new PopupMenu.PopupMenuItem(_("LAUNCHERS") , { reactive: false });
            launchersPane.addMenuItem(title);
            
            this.launchersSection = new PopupMenu.PopupMenuSection();
            launchersPane.addMenuItem(this.launchersSection);
            
            mainBox.add_actor(launchersPane.actor, { span: 1 });
            this._build_launchers_section();
            
            let paddingBox = new St.BoxLayout();
            paddingBox.set_width(MENU_PADDING_WIDTH);
            mainBox.add_actor(paddingBox);
            
            //pictures section
            if ( this.showPictures ) {
                
                let picturesPane = new PopupMenu.PopupMenuSection();
                let title = new PopupMenu.PopupMenuItem(_("PICTURES") , { reactive: false });
                picturesPane.addMenuItem(title);
                
                let pictureScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START });
                this.pictureSection = new PopupMenu.PopupMenuSection();
                pictureScrollBox.add_actor(this.pictureSection.actor);
                picturesPane.actor.add_actor(pictureScrollBox);
                
                mainBox.add_actor(picturesPane.actor, { span: 1 });
                this._build_pictures_section();
                
                let paddingBox = new St.BoxLayout();
                paddingBox.set_width(MENU_PADDING_WIDTH);
                mainBox.add_actor(paddingBox);
                
            }
            
            //recent documents section
            if ( this.showRecentDocuments ) {
                
                let recentPane = new PopupMenu.PopupMenuSection();
                mainBox.add_actor(recentPane.actor, { span: 1 });
                
                let title = new PopupMenu.PopupMenuItem(_("RECENT DOCUMENTS"), { reactive: false });
                recentPane.addMenuItem(title);
                
                let recentScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START });
                this.recentSection = new PopupMenu.PopupMenuSection();
                recentScrollBox.add_actor(this.recentSection.actor);
                recentPane.actor.add_actor(recentScrollBox);
                
                let clearRecent = new ClearRecentMenuItem(this.menu, this.recentManager);
                recentPane.addMenuItem(clearRecent);
                
                this._build_recent_documents_section();
                
            }
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    _build_launchers_section: function() {
        
        this.launchersSection.removeAll();
        
        let apps = [];
        let tree = this.appSys.get_tree();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ( (nextType = iter.next()) != GMenu.TreeItemType.INVALID ) {
            if ( nextType == GMenu.TreeItemType.DIRECTORY ) {
                let dir = iter.get_directory();
                if ( dir.get_menu_id() == _("Graphics") ) {
                    dirIter = dir.iter();
                    while (( nextType = dirIter.next()) != GMenu.TreeItemType.INVALID ) {
                        if ( nextType == GMenu.TreeItemType.ENTRY ) {
                            let entry = dirIter.get_entry();
                            if (!entry.get_app_info().get_nodisplay()) {
                                var app = this.appSys.lookup_app_by_tree_entry(entry);
                                let launcherItem = new LauncherMenuItem(this.menu, app);
                                this.launchersSection.addMenuItem(launcherItem);
                            }
                        }
                    }
                }
            }
        }
        
    },
    
    _build_pictures_section: function() {
        
        this.pictureSection.removeAll();
        
        if ( this.altDir == "" ) path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        else path = this.altDir;
        let dir = Gio.file_new_for_path(path);
        let pictures = this._get_pictures(dir);
        for ( let i = 0; i < pictures.length; i++ ) {
            let picture = pictures[i];
            let pictureItem = new PictureMenuItem(this.menu, picture);
            this.pictureSection.addMenuItem(pictureItem);
        }
        
    },
    
    _get_pictures: function(dir) {
        
        let pictures = [];
        let gEnum = dir.enumerate_children("*", Gio.FileQueryInfoFlags.NONE, null);
        while ( (info = gEnum.next_file(null)) != null ) {
            if ( info.get_is_hidden() ) continue;
            if ( info.get_file_type() == Gio.FileType.DIRECTORY && this.recursePictures ) {
                let childDir = dir.get_child(info.get_name());
                pictures = pictures.concat(this._get_pictures(childDir));
            }
            else {
                if ( info.get_content_type().search("image") == -1 ) continue;
                pictures.push(dir.get_child(info.get_name()));
            }
        }
        return pictures;
        
    },
    
    _build_recent_documents_section: function() {
        
        this.recentSection.removeAll();
        
        let recentDocuments = this.recentManager.get_items();
        
        let showCount;
        if ( this.recentSizeLimit == 0 ) showCount = recentDocuments.length;
        else showCount = ( this.recentSizeLimit < recentDocuments.length ) ? this.recentSizeLimit : recentDocuments.length;
        for ( let i = 0; i < showCount; i++ ) {
            let recentInfo = recentDocuments[i];
            let mimeType = recentInfo.get_mime_type().replace("\/","-");
            let recentItem = new RecentMenuItem(this.menu, recentInfo.get_display_name(), mimeType, recentInfo.get_uri());
            this.recentSection.addMenuItem(recentItem);
        }
        
    },
    
    _set_panel_icon: function() {
        if ( this.panelIcon.split("/").length > 1 ) this.set_applet_icon_path(this.panelIcon);
        else this.set_applet_icon_name(this.panelIcon);
    },
    
    _set_panel_text: function() {
        if ( this.panelText ) this.set_applet_label(this.panelText);
        else this.set_applet_label("");
    }
};


function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(orientation, panel_height, instanceId);
    return myApplet;
}