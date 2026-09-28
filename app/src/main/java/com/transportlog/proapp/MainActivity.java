package com.transportlog.proapp;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
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
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

public class MainActivity extends Activity {

    private static final int CAMERA_PERMISSION_REQUEST = 501;
    private static final int NATIVE_QR_CAMERA_PERMISSION_REQUEST = 503;
    private static final int NATIVE_QR_PHOTO_REQUEST = 504;
    private static final int FILE_CHOOSER_REQUEST = 502;

    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraOutputUri;
    private Uri nativeQrCameraOutputUri;
    private boolean googleQrScannerOpen;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ draws apps behind the status bar. Keep the existing HTML
        // layout unchanged, but move its entire WebView below the system clock.
        FrameLayout safeAreaRoot = new FrameLayout(this);
        safeAreaRoot.setBackgroundColor(Color.WHITE);
        webView = new WebView(this);
        safeAreaRoot.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        if (Build.VERSION.SDK_INT >= 35) {
            ViewCompat.setOnApplyWindowInsetsListener(safeAreaRoot, (view, windowInsets) -> {
                Insets topSafeArea = windowInsets.getInsets(
                        WindowInsetsCompat.Type.statusBars()
                                | WindowInsetsCompat.Type.displayCutout()
                );
                // Only the top/side system insets are applied here. The existing
                // bottom navigation and its CSS safe-area margin remain untouched.
                view.setPadding(topSafeArea.left, topSafeArea.top, topSafeArea.right, 0);
                return windowInsets;
            });
        }
        setContentView(safeAreaRoot);
        if (Build.VERSION.SDK_INT >= 35) {
            ViewCompat.requestApplyInsets(safeAreaRoot);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

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

    private void showQrScannerStatus(String message) {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "if(typeof showQrStatus==='function')showQrStatus("
                                + JSONObject.quote(message) + ")",
                        null
                );
            }
        });
    }

    /**
     * Prefer Google Code Scanner with autofocus/auto-zoom and its own camera UI.
     * On devices without the required Play services module, fall back to the
     * locally bundled ZXing scanner instead of leaving the button unresponsive.
     */
    private void startNativeQrScanner() {
        runOnUiThread(() -> {
            if (googleQrScannerOpen) return;
            googleQrScannerOpen = true;
            showQrScannerStatus("자동 확대 QR 카메라를 여는 중입니다. 처음에는 잠시 걸릴 수 있습니다.");
            try {
                GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                        .enableAutoZoom()
                        .build();
                GmsBarcodeScanning.getClient(MainActivity.this, options)
                        .startScan()
                        .addOnSuccessListener(barcode -> {
                            googleQrScannerOpen = false;
                            String decoded = normalizeQrEncoding(barcode.getRawValue(), barcode.getRawBytes());
                            if (decoded == null || decoded.trim().isEmpty()) {
                                decoded = normalizeQrEncoding(barcode.getDisplayValue(), barcode.getRawBytes());
                            }
                            if (decoded != null && !decoded.trim().isEmpty()) {
                                showQrScannerStatus("QR 판독 완료. 운송정보를 확인합니다.");
                                deliverQrResultToWeb(decoded);
                            } else {
                                showQrScannerStatus("QR을 감지했지만 문자 데이터를 읽지 못했습니다. 보조 카메라로 다시 시도해 주세요.");
                                Toast.makeText(MainActivity.this,
                                        "QR 내용이 비어 있습니다. 다시 시도해 주세요.", Toast.LENGTH_LONG).show();
                            }
                        })
                        .addOnCanceledListener(() -> {
                            googleQrScannerOpen = false;
                            showQrScannerStatus("QR 스캔을 취소했습니다. 다시 시도할 수 있습니다.");
                        })
                        .addOnFailureListener(error -> {
                            googleQrScannerOpen = false;
                            showQrScannerStatus("자동 QR 카메라를 열 수 없어 보조 카메라를 실행합니다.");
                            startZxingFallbackScanner();
                        });
            } catch (Exception | LinkageError error) {
                googleQrScannerOpen = false;
                showQrScannerStatus("자동 QR 카메라를 사용할 수 없어 보조 카메라를 실행합니다.");
                startZxingFallbackScanner();
            }
        });
    }

    private void startZxingFallbackScanner() {
        runOnUiThread(() -> {
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.CAMERA},
                        NATIVE_QR_CAMERA_PERMISSION_REQUEST
                );
                return;
            }
            launchNativeQrScanner();
        });
    }

    private void launchNativeQrScanner() {
        try {
            IntentIntegrator integrator = new IntentIntegrator(MainActivity.this);
            // Let ZXing choose the back camera. Camera ID 0 is not universally rear.
            integrator.setDesiredBarcodeFormats(Collections.singletonList("QR_CODE"));
            integrator.setPrompt("QR 코드를 사각형 안에 맞춰주세요");
            integrator.setBeepEnabled(true);
            integrator.setBarcodeImageEnabled(false);
            integrator.setOrientationLocked(true);
            integrator.initiateScan();
        } catch (Exception e) {
            showQrScannerStatus("보조 QR 카메라 실행 실패: " + e.getMessage());
            Toast.makeText(MainActivity.this,
                    "QR 카메라 실행 실패: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private static String normalizeQrEncoding(String decoded, byte[] rawBytes) {
        if (decoded == null) decoded = "";
        Charset korean = Charset.forName("MS949");
        String best = decoded;
        // Some shipping slips encode Hangul as CP949 with no QR ECI metadata.
        // QR scanners then expose Latin-1 mojibake despite successful camera recognition.
        try {
            String restored = new String(decoded.getBytes(StandardCharsets.ISO_8859_1), korean);
            if (scoreQrText(restored) > scoreQrText(best)) best = restored;
        } catch (Exception ignored) { }
        if (rawBytes != null && rawBytes.length > 0) {
            try {
                String restored = new String(rawBytes, korean);
                if (scoreQrText(restored) > scoreQrText(best)) best = restored;
            } catch (Exception ignored) { }
        }
        return best;
    }

    private static int scoreQrText(String value) {
        if (value == null) return -100;
        int score = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) score += 4;
            if (c == '@') score += 2;
            if (c == '\uFFFD') score -= 12;
        }
        if (value.contains("CB0010@")) score += 20;
        return score;
    }

    private void deliverQrResultToWeb(String rawValue) {
        if (rawValue == null || rawValue.trim().isEmpty()) {
            Toast.makeText(this, "QR 내용을 읽지 못했습니다. 다시 시도해주세요.", Toast.LENGTH_LONG).show();
            return;
        }
        // applyQR() returns true only if the payload contains supported freight
        // fields. Do not claim auto-fill succeeded for ordinary URLs or other QR text.
        String js = "(typeof applyQR==='function' ? applyQR(" + JSONObject.quote(rawValue)
                + ") : 'parser_missing')";
        webView.evaluateJavascript(js, value -> {
            if ("true".equals(value)) {
                Toast.makeText(MainActivity.this, "QR 인식 및 운송정보 전달 완료", Toast.LENGTH_SHORT).show();
            } else if ("\"parser_missing\"".equals(value)) {
                Toast.makeText(MainActivity.this, "QR은 읽었지만 운송정보 화면이 준비되지 않았습니다.", Toast.LENGTH_LONG).show();
            }
            // For false, the QR page itself shows the decoded text and explanation.
        });
    }

    private void startNativeQrPhotoScan() {
        runOnUiThread(() -> {
            try {
                Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
                gallery.addCategory(Intent.CATEGORY_OPENABLE);
                gallery.setType("image/*");

                Intent chooser = Intent.createChooser(gallery, "QR 사진 촬영 또는 선택");
                nativeQrCameraOutputUri = null;
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    try {
                        File image = File.createTempFile("native_qr_", ".jpg", getCacheDir());
                        nativeQrCameraOutputUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                image
                        );
                        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        camera.putExtra(MediaStore.EXTRA_OUTPUT, nativeQrCameraOutputUri);
                        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                    } catch (Exception ignored) {
                        nativeQrCameraOutputUri = null;
                    }
                }
                startActivityForResult(chooser, NATIVE_QR_PHOTO_REQUEST);
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "QR 사진 선택 실패: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void decodeNativeQrPhoto(Uri uri) {
        // Read and decode locally with the ZXing library already bundled in the APK.
        // This works without relying on a remote JavaScript CDN.
        new Thread(() -> {
            String result = null;
            String failure = null;
            try {
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                try (InputStream stream = getContentResolver().openInputStream(uri)) {
                    if (stream == null) throw new IllegalStateException("사진 파일을 열 수 없습니다.");
                    BitmapFactory.decodeStream(stream, null, bounds);
                }
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                    throw new IllegalStateException("사진 형식을 읽지 못했습니다.");
                }
                int sampleSize = 1;
                while (Math.max(bounds.outWidth / sampleSize, bounds.outHeight / sampleSize) > 2048) {
                    sampleSize *= 2;
                }
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = sampleSize;
                options.inPreferredConfig = Bitmap.Config.ARGB_8888;
                Bitmap bitmap;
                try (InputStream stream = getContentResolver().openInputStream(uri)) {
                    if (stream == null) throw new IllegalStateException("사진 파일을 열 수 없습니다.");
                    bitmap = BitmapFactory.decodeStream(stream, null, options);
                }
                if (bitmap == null) throw new IllegalStateException("사진을 불러오지 못했습니다.");
                Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
                hints.put(DecodeHintType.POSSIBLE_FORMATS, Collections.singletonList(com.google.zxing.BarcodeFormat.QR_CODE));
                hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
                for (int degrees : new int[]{0, 90, 180, 270}) {
                    Bitmap rotated = bitmap;
                    if (degrees != 0) {
                        Matrix matrix = new Matrix();
                        matrix.postRotate(degrees);
                        rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                    }
                    try {
                        int width = rotated.getWidth();
                        int height = rotated.getHeight();
                        int[] pixels = new int[width * height];
                        rotated.getPixels(pixels, 0, width, 0, 0, width, height);
                        BinaryBitmap binary = new BinaryBitmap(new HybridBinarizer(
                                new RGBLuminanceSource(width, height, pixels)
                        ));
                        MultiFormatReader reader = new MultiFormatReader();
                        reader.setHints(hints);
                        Result decoded = reader.decodeWithState(binary);
                        if (decoded != null && decoded.getText() != null && !decoded.getText().isEmpty()) {
                            result = decoded.getText();
                            break;
                        }
                    } catch (ReaderException ignored) {
                        // Some photos carry rotation metadata; try all orientations.
                    } finally {
                        if (rotated != bitmap) rotated.recycle();
                    }
                }
                bitmap.recycle();
                if (result == null) failure = "이 사진에서 QR 코드를 찾지 못했습니다. 더 가까이 촬영해 주세요.";
            } catch (Exception e) {
                failure = "QR 사진 인식 실패: " + e.getMessage();
            }
            final String decodedText = result;
            final String errorMessage = failure;
            runOnUiThread(() -> {
                if (decodedText != null) {
                    deliverQrResultToWeb(normalizeQrEncoding(decodedText, null));
                } else {
                    Toast.makeText(MainActivity.this, errorMessage, Toast.LENGTH_LONG).show();
                }
            });
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == NATIVE_QR_CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchNativeQrScanner();
            } else {
                Toast.makeText(
                        this,
                        "QR 스캔을 사용하려면 앱 설정에서 카메라 권한을 허용해주세요.",
                        Toast.LENGTH_LONG
                ).show();
            }
            return;
        }

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
                deliverQrResultToWeb(normalizeQrEncoding(qrResult.getContents(), qrResult.getRawBytes()));
            } else {
                Toast.makeText(this, "QR 스캔을 취소했습니다.", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == NATIVE_QR_PHOTO_REQUEST) {
            Uri selectedPhoto = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    selectedPhoto = data.getData();
                } else {
                    selectedPhoto = nativeQrCameraOutputUri;
                }
            }
            nativeQrCameraOutputUri = null;
            if (selectedPhoto != null) decodeNativeQrPhoto(selectedPhoto);
            return;
        }
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
        public void startNativeQrFallbackScan() {
            startZxingFallbackScanner();
        }

        @JavascriptInterface
        public void startNativeQrPhotoScan() {
            MainActivity.this.startNativeQrPhotoScan();
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
