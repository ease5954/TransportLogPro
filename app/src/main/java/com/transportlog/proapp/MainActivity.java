package com.transportlog.proapp;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Collections;

public class MainActivity extends Activity {

    private static final int CAMERA_PERMISSION_REQUEST = 501;
    private static final int FILE_CHOOSER_REQUEST = 502;

    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraOutputUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        final WebViewAssetLoader assetLoader =
                new WebViewAssetLoader.Builder()
                        .setDomain("appassets.androidplatform.net")
                        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                        .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                        "(function(){"
                                + "if(!window.__legacyStartQR&&window.startQR){window.__legacyStartQR=window.startQR;}"
                                + "window.startQR=function(){"
                                + "try{"
                                + "if(window.AndroidBridge&&AndroidBridge.startNativeQrScan){AndroidBridge.startNativeQrScan();return;}"
                                + "}catch(e){}"
                                + "if(window.__legacyStartQR){window.__legacyStartQR();}"
                                + "};"
                                + "})();",
                        null
                );
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if ("tel".equalsIgnoreCase(scheme)) {
                    startActivity(new Intent(Intent.ACTION_DIAL, uri));
                    return true;
                }

                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    String host = uri.getHost();
                    if ("appassets.androidplatform.net".equalsIgnoreCase(host)) return false;
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            wantsCamera = true;
                            break;
                        }
                    }

                    if (!wantsCamera) {
                        request.deny();
                        return;
                    }

                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingWebPermission = request;
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                CAMERA_PERMISSION_REQUEST
                        );
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
                galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
                galleryIntent.setType("image/*");

                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                try {
                    File imageFile = File.createTempFile("qr_", ".jpg", getCacheDir());
                    cameraOutputUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            imageFile
                    );
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
                    cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception e) {
                    cameraIntent = null;
                }

                Intent chooser = Intent.createChooser(galleryIntent, "QR 사진 촬영 또는 선택");
                if (cameraIntent != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                try {
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
            }
        });

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private void startNativeQrScanner() {
        runOnUiThread(() -> {
            try {
                IntentIntegrator integrator = new IntentIntegrator(MainActivity.this);
                integrator.setDesiredBarcodeFormats(Collections.singletonList("QR_CODE"));
                integrator.setPrompt("QR 코드를 사각형 안에 맞춰주세요");
                integrator.setCameraId(0);
                integrator.setBeepEnabled(true);
                integrator.setBarcodeImageEnabled(false);
                integrator.setOrientationLocked(true);
                Toast.makeText(MainActivity.this, "QR 스캐너를 시작합니다.", Toast.LENGTH_SHORT).show();
                integrator.initiateScan();
            } catch (Exception e) {
                Toast.makeText(
                        MainActivity.this,
                        "QR 스캐너 시작 실패: " + e.getMessage(),
                        Toast.LENGTH_LONG
                ).show();
            }
        });
    }

    private void deliverQrResultToWeb(String rawValue) {
        if (rawValue == null || rawValue.trim().isEmpty()) {
            Toast.makeText(this, "QR 내용을 읽지 못했습니다. 다시 시도해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        String js = "applyQR(" + JSONObject.quote(rawValue) + ")";
        webView.evaluateJavascript(js, value ->
                Toast.makeText(MainActivity.this, "QR 인식 완료", Toast.LENGTH_SHORT).show());
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingWebPermission != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingWebPermission.deny();
                Toast.makeText(this, "카메라 권한을 허용해주세요.", Toast.LENGTH_LONG).show();
            }
            pendingWebPermission = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult qrResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (qrResult != null) {
            if (qrResult.getContents() != null) {
                deliverQrResultToWeb(qrResult.getContents());
            } else {
                Toast.makeText(this, "QR 스캔을 취소했습니다.", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            } else if (cameraOutputUri != null) {
                results = new Uri[]{cameraOutputUri};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraOutputUri = null;
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
                "(function(){"
                        + "var i=document.getElementById('insuranceOverlay');"
                        + "if(i&&i.classList.contains('show')){closeInsuranceOverlay();return 'closed';}"
                        + "var m=document.getElementById('installOverlay');"
                        + "if(m&&m.classList.contains('show')){closeInstallOverlay();return 'closed';}"
                        + "return 'none';"
                        + "})()",
                value -> {
                    if ("\"closed\"".equals(value)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else MainActivity.super.onBackPressed();
                }
        );
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void startNativeQrScan() {
            startNativeQrScanner();
        }

        @JavascriptInterface
        public void saveBase64File(String filename, String dataUrl) {
            try {
                String safeName = (filename == null || filename.trim().isEmpty()) ? "운송일보.xlsx" : filename.trim();
                String base64 = dataUrl;
                int comma = dataUrl.indexOf(',');
                if (comma >= 0) base64 = dataUrl.substring(comma + 1);
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

                String savedLocation;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/운송일보");

                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("Download insert failed");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IllegalStateException("Output stream failed");
                        out.write(bytes);
                        out.flush();
                    }
                    savedLocation = "다운로드/운송일보/" + safeName;
                } else {
                    File root = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (root == null) root = getFilesDir();
                    File dir = new File(root, "운송일보");
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("폴더 생성 실패");
                    File target = new File(dir, safeName);
                    try (FileOutputStream out = new FileOutputStream(target)) {
                        out.write(bytes);
                        out.flush();
                    }
                    savedLocation = target.getAbsolutePath();
                }

                final String message = "Excel 저장 완료: " + savedLocation;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());

            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(
                        MainActivity.this,
                        "Excel 저장 실패: " + e.getMessage(),
                        Toast.LENGTH_LONG
                ).show());
            }
        }

        @JavascriptInterface
        public void openAppSettings() {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }
}
