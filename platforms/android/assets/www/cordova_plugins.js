cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/cordova-sqlite-storage/www/SQLitePlugin.js",
        "id": "cordova-sqlite-storage.SQLitePlugin",
        "clobbers": [
            "SQLitePlugin"
        ]
    },
    {
        "file": "plugins/cordova_app_version_plugin/www/getAppVersion.js",
        "id": "cordova_app_version_plugin.getAppVersion",
        "clobbers": [
            "cordova.plugins.version"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "cordova-plugin-whitelist": "1.2.2",
    "cordova-sqlite-storage": "1.4.7",
    "cordova_app_version_plugin": "0.2.6"
};
// BOTTOM OF METADATA
});