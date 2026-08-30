package com.zeeshan.apphub

import android.content.pm.PackageManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import java.io.File

class AppCheckModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val CHANNEL_ID = "download_channel"
        private const val CHANNEL_NAME = "App Downloads"
    }

    override fun getName(): String {
        return "AppCheckModule"
    }

    private fun getNotificationManager(): NotificationManager {
        val manager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows downloading and installation progress for apps"
                    setShowBadge(false)
                    setSound(null, null)
                    enableVibration(false)
                }
                manager.createNotificationChannel(channel)
            }
        }
        return manager
    }

    @ReactMethod
    fun showDownloadProgressNotification(
        notificationId: Double,
        title: String,
        progress: Double,
        speedText: String,
        sizeText: String,
        promise: Promise
    ) {
        try {
            val manager = getNotificationManager()
            val id = notificationId.toInt()
            val pct = (progress * 100).toInt().coerceIn(0, 100)

            val contentText = if (speedText.isNotEmpty() && sizeText.isNotEmpty()) {
                "$sizeText • $speedText"
            } else if (sizeText.isNotEmpty()) {
                sizeText
            } else {
                "Downloading... $pct%"
            }

            // Clicking open app
            val launchIntent = reactApplicationContext.packageManager.getLaunchIntentForPackage(reactApplicationContext.packageName)
            val pendingIntent = if (launchIntent != null) {
                PendingIntent.getActivity(
                    reactApplicationContext,
                    id,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            } else null

            val iconResId = reactApplicationContext.resources.getIdentifier("ic_launcher", "mipmap", reactApplicationContext.packageName)
                .takeIf { it != 0 } ?: android.R.drawable.stat_sys_download

            val builder = NotificationCompat.Builder(reactApplicationContext, CHANNEL_ID)
                .setSmallIcon(iconResId)
                .setContentTitle(title)
                .setContentText(contentText)
                .setProgress(100, pct, progress <= 0)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)

            if (pendingIntent != null) {
                builder.setContentIntent(pendingIntent)
            }

            manager.notify(id, builder.build())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_NOTIF", e.message, e)
        }
    }

    @ReactMethod
    fun showDownloadCompleteNotification(
        notificationId: Double,
        title: String,
        filePath: String,
        promise: Promise
    ) {
        try {
            val manager = getNotificationManager()
            val id = notificationId.toInt()

            val cleanPath = filePath.removePrefix("file://")
            val apkFile = File(cleanPath)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    try {
                        FileProvider.getUriForFile(
                            reactApplicationContext,
                            "${reactApplicationContext.packageName}.FileSystemFileProvider",
                            apkFile
                        )
                    } catch (e: Exception) {
                        try {
                            FileProvider.getUriForFile(
                                reactApplicationContext,
                                "${reactApplicationContext.packageName}.provider",
                                apkFile
                            )
                        } catch (e2: Exception) {
                            Uri.fromFile(apkFile)
                        }
                    }
                } else {
                    Uri.fromFile(apkFile)
                }

                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            val pendingIntent = PendingIntent.getActivity(
                reactApplicationContext,
                id + 1000,
                installIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val iconResId = reactApplicationContext.resources.getIdentifier("ic_launcher", "mipmap", reactApplicationContext.packageName)
                .takeIf { it != 0 } ?: android.R.drawable.stat_sys_download_done

            val builder = NotificationCompat.Builder(reactApplicationContext, CHANNEL_ID)
                .setSmallIcon(iconResId)
                .setContentTitle(title)
                .setContentText("Download complete. Tap to install")
                .setProgress(0, 0, false)
                .setOngoing(false)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .addAction(android.R.drawable.ic_menu_upload, "Install", pendingIntent)

            manager.notify(id, builder.build())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_NOTIF_COMPLETE", e.message, e)
        }
    }

    @ReactMethod
    fun dismissNotification(notificationId: Double, promise: Promise) {
        try {
            val manager = getNotificationManager()
            manager.cancel(notificationId.toInt())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_DISMISS", e.message, e)
        }
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
