package com.zeeshan.apphub

import android.content.pm.PackageManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

class AppCheckModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AppCheckModule"
    }

    @ReactMethod
    fun getAppInfo(packageName: String, promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            
            val map = Arguments.createMap()
            map.putBoolean("isInstalled", true)
            map.putString("versionName", packageInfo.versionName)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                map.putDouble("versionCode", packageInfo.longVersionCode.toDouble())
            } else {
                @Suppress("DEPRECATION")
                map.putDouble("versionCode", packageInfo.versionCode.toDouble())
            }
            promise.resolve(map)
        } catch (e: PackageManager.NameNotFoundException) {
            val map = Arguments.createMap()
            map.putBoolean("isInstalled", false)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("ERROR_LAUNCH", "No launch intent found for package: $packageName")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }
}

class AppCheckPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        val modules = ArrayList<NativeModule>()
        modules.add(AppCheckModule(reactContext))
        return modules
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
