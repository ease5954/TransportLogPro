package com.transportlog.proapp;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.Size;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import com.google.zxing.client.android.Intents;
import com.yanzhenjie.zbar.Config;
import com.yanzhenjie.zbar.Image;
import com.yanzhenjie.zbar.ImageScanner;
import com.yanzhenjie.zbar.Symbol;
import com.yanzhenjie.zbar.SymbolSet;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Dual-engine high-resolution QR scanner for cement waybills.
 *
 * 1.6.8 preserves the original decoded QR bytes when ZBar succeeds. Hanil's
 * CB0010 payload is CP949/MS949 and loses Korean characters if only ZBar's
 * already-decoded Java String is returned. Passing the raw bytes lets
 * MainActivity perform the existing MS949 restoration before JavaScript parses
 * individual fields.
 */
public class CustomQrCaptureActivity extends ComponentActivity {
    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private Camera activeCamera;
    private ExecutorService analyzerExecutor;
    private ImageScanner zbarScanner;
    private BarcodeScanner mlKitScanner;
    private volatile boolean resultDelivered;
    private volatile boolean mlKitBusy;
    private volatile long lastAnalysisMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);

        zbarScanner = new ImageScanner();
        zbarScanner.setConfig(0, Config.X_DENSITY, 1);
        zbarScanner.setConfig(0, Config.Y_DENSITY, 1);

        BarcodeScannerOptions mlOptions = new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build();
        mlKitScanner = BarcodeScanning.getClient(mlOptions);
        analyzerExecutor = Executors.newSingleThreadExecutor();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        previewView = new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        previewView.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                focusAt(event.getX(), event.getY());
                view.performClick();
            }
            return true;
        });
        root.addView(previewView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        View guide = new View(this);
        GradientDrawable border = new GradientDrawable();
        border.setColor(Color.TRANSPARENT);
        border.setStroke(dp(4), Color.rgb(33, 196, 107));
        border.setCornerRadius(dp(18));
        guide.setBackground(border);
        guide.setClickable(false);
        guide.setFocusable(false);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int guideSize = Math.min(dp(350), screenWidth - dp(20));
        FrameLayout.LayoutParams guideParams = new FrameLayout.LayoutParams(guideSize, guideSize);
        guideParams.gravity = Gravity.CENTER;
        root.addView(guide, guideParams);

        TextView title = new TextView(this);
        title.setText("운송 QR 정밀 스캔 1.6.8\n원본 바이트 + 이중 판독");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        title.setPadding(dp(16), dp(14), dp(16), dp(14));
        title.setBackgroundColor(Color.argb(165, 0, 0, 0));
        FrameLayout.LayoutParams titleParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.gravity = Gravity.TOP;
        titleParams.topMargin = dp(22);
        root.addView(title, titleParams);

        TextView hint = new TextView(this);
        hint.setText("QR 네 모서리를 사각형 안에 넣고 15~25cm에서 고정하세요\n흐리면 QR 가운데를 한 번 터치하세요");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(15);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(18), dp(12), dp(18), dp(12));
        hint.setBackgroundColor(Color.argb(165, 0, 0, 0));
        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        hintParams.gravity = Gravity.BOTTOM;
        hintParams.bottomMargin = dp(30);
        root.addView(hint, hintParams);

        setContentView(root);
        startCamera();
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                cameraProvider = future.get();

                Preview preview = new Preview.Builder()
                        .setTargetResolution(new Size(1920, 1080))
                        .build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setTargetResolution(new Size(1920, 1080))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analysis.setAnalyzer(analyzerExecutor, this::analyzeFrame);

                cameraProvider.unbindAll();
                activeCamera = cameraProvider.bindToLifecycle(
                        this,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis
                );

                ZoomState state = activeCamera.getCameraInfo().getZoomState().getValue();
                if (state != null) {
                    float target = Math.min(1.30f, state.getMaxZoomRatio());
                    target = Math.max(target, state.getMinZoomRatio());
                    activeCamera.getCameraControl().setZoomRatio(target);
                }

                previewView.postDelayed(() -> focusAt(
                        previewView.getWidth() / 2f,
                        previewView.getHeight() / 2f
                ), 500);
            } catch (Exception error) {
                Toast.makeText(this, "QR 카메라 실행 실패: " + error.getMessage(), Toast.LENGTH_LONG).show();
                setResult(Activity.RESULT_CANCELED);
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void focusAt(float x, float y) {
        Camera camera = activeCamera;
        if (camera == null || previewView.getWidth() <= 0 || previewView.getHeight() <= 0) return;
        try {
            MeteringPoint point = previewView.getMeteringPointFactory().createPoint(x, y);
            FocusMeteringAction action = new FocusMeteringAction.Builder(
                    point,
                    FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE
            ).setAutoCancelDuration(3, TimeUnit.SECONDS).build();
            camera.getCameraControl().startFocusAndMetering(action);
        } catch (Exception ignored) {
            // Keep scanning with the camera's default continuous autofocus.
        }
    }

    @ExperimentalGetImage
    private void analyzeFrame(ImageProxy proxy) {
        if (resultDelivered) {
            proxy.close();
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastAnalysisMs < 140) {
            proxy.close();
            return;
        }
        lastAnalysisMs = now;

        // Keep the proven ZBar route first. Unlike 1.6.7, retain the original QR
        // bytes so Hanil CP949 text can be reconstructed instead of keeping mojibake.
        try {
            GrayFrame raw = copyLuma(proxy);
            GrayFrame upright = rotate(raw, proxy.getImageInfo().getRotationDegrees());
            DecodedQr zbar = scanWithZBar(upright);
            if (zbar != null && zbar.text != null && !zbar.text.trim().isEmpty()) {
                // If this is Hanil but this ZBar wrapper did not expose raw bytes,
                // do not immediately return its mojibake String. Give ML Kit the
                // same frame a chance to provide raw bytes first.
                if (zbar.rawBytes != null || !looksLikeHanil(zbar.text)) {
                    resultDelivered = true;
                    proxy.close();
                    final String decoded = zbar.text;
                    final byte[] decodedBytes = zbar.rawBytes;
                    runOnUiThread(() -> deliverResult(decoded, decodedBytes));
                    return;
                }
            }
        } catch (Throwable ignored) {
            // Fall through to ML Kit on the same camera frame.
        }

        if (mlKitBusy || resultDelivered || proxy.getImage() == null) {
            proxy.close();
            return;
        }

        mlKitBusy = true;
        InputImage input;
        try {
            input = InputImage.fromMediaImage(
                    proxy.getImage(),
                    proxy.getImageInfo().getRotationDegrees()
            );
        } catch (Throwable error) {
            mlKitBusy = false;
            proxy.close();
            return;
        }

        mlKitScanner.process(input)
                .addOnSuccessListener(analyzerExecutor, barcodes -> {
                    if (resultDelivered || barcodes == null) return;
                    for (Barcode barcode : barcodes) {
                        if (barcode == null || barcode.getFormat() != Barcode.FORMAT_QR_CODE) continue;
                        byte[] rawBytes = barcode.getRawBytes();
                        String text = barcode.getRawValue();
                        if (text == null || text.trim().isEmpty()) text = barcode.getDisplayValue();
                        if ((text == null || text.trim().isEmpty()) && rawBytes != null && rawBytes.length > 0) {
                            text = new String(rawBytes, StandardCharsets.ISO_8859_1);
                        }
                        if (text != null && !text.trim().isEmpty()) {
                            final String decoded = text;
                            final byte[] decodedBytes = rawBytes;
                            resultDelivered = true;
                            runOnUiThread(() -> deliverResult(decoded, decodedBytes));
                            break;
                        }
                    }
                })
                .addOnCompleteListener(analyzerExecutor, task -> {
                    mlKitBusy = false;
                    proxy.close();
                });
    }

    private boolean looksLikeHanil(String text) {
        return text != null && text.contains("CB0010@");
    }

    private DecodedQr scanWithZBar(GrayFrame upright) {
        DecodedQr result = scan(upright);
        if (result != null) return result;

        GrayFrame crop90 = centerCrop(upright, 0.90f);
        result = scan(crop90);
        if (result != null) return result;

        GrayFrame crop76 = centerCrop(upright, 0.76f);
        result = scan(crop76);
        if (result != null) return result;

        GrayFrame crop62 = centerCrop(upright, 0.62f);
        result = scan(crop62);
        if (result != null) return result;

        GrayFrame enhanced = stretchContrast(crop76);
        result = scan(enhanced);
        if (result != null) return result;

        result = scan(otsuThreshold(enhanced));
        if (result != null) return result;

        return scan(scaleNearest(stretchContrast(crop62), 1.50f));
    }

    private DecodedQr scan(GrayFrame frame) {
        if (frame == null || frame.width < 180 || frame.height < 180) return null;
        Image barcode = new Image(frame.width, frame.height, "Y800");
        barcode.setData(frame.data);
        if (zbarScanner.scanImage(barcode) == 0) return null;
        SymbolSet symbols = zbarScanner.getResults();
        for (Symbol symbol : symbols) {
            String data = symbol.getData();
            if (data == null || data.trim().isEmpty()) continue;
            return new DecodedQr(data, extractZbarRawBytes(symbol));
        }
        return null;
    }

    /**
     * Some ZBar Android wrappers expose Symbol#getDataBytes(), while older forks
     * expose only getData(). Reflection keeps this build compatible with both.
     */
    private byte[] extractZbarRawBytes(Symbol symbol) {
        if (symbol == null) return null;
        try {
            java.lang.reflect.Method method = symbol.getClass().getMethod("getDataBytes");
            Object value = method.invoke(symbol);
            if (value instanceof byte[]) {
                byte[] bytes = (byte[]) value;
                return bytes.length == 0 ? null : bytes;
            }
        } catch (Throwable ignored) {
            // ML Kit will be attempted for Hanil when raw bytes are unavailable.
        }
        return null;
    }

    private GrayFrame copyLuma(ImageProxy proxy) {
        int width = proxy.getWidth();
        int height = proxy.getHeight();
        ImageProxy.PlaneProxy plane = proxy.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer().duplicate();
        int rowStride = plane.getRowStride();
        int pixelStride = plane.getPixelStride();
        int base = buffer.position();
        byte[] out = new byte[width * height];

        if (pixelStride == 1 && rowStride == width && buffer.remaining() >= out.length) {
            buffer.get(out, 0, out.length);
            return new GrayFrame(out, width, height);
        }

        byte[] row = new byte[rowStride];
        for (int y = 0; y < height; y++) {
            int rowPosition = base + y * rowStride;
            if (rowPosition >= buffer.limit()) break;
            buffer.position(rowPosition);
            int available = Math.min(rowStride, buffer.remaining());
            buffer.get(row, 0, available);
            for (int x = 0; x < width; x++) {
                int src = x * pixelStride;
                if (src < available) out[y * width + x] = row[src];
            }
        }
        return new GrayFrame(out, width, height);
    }

    private GrayFrame rotate(GrayFrame src, int degrees) {
        int d = ((degrees % 360) + 360) % 360;
        if (d == 0) return src;
        if (d == 180) {
            byte[] out = new byte[src.data.length];
            for (int i = 0; i < src.data.length; i++) out[src.data.length - 1 - i] = src.data[i];
            return new GrayFrame(out, src.width, src.height);
        }
        if (d == 90 || d == 270) {
            int nw = src.height;
            int nh = src.width;
            byte[] out = new byte[src.data.length];
            for (int y = 0; y < src.height; y++) {
                for (int x = 0; x < src.width; x++) {
                    int sourceIndex = y * src.width + x;
                    int nx;
                    int ny;
                    if (d == 90) {
                        nx = src.height - 1 - y;
                        ny = x;
                    } else {
                        nx = y;
                        ny = src.width - 1 - x;
                    }
                    out[ny * nw + nx] = src.data[sourceIndex];
                }
            }
            return new GrayFrame(out, nw, nh);
        }
        return src;
    }

    private GrayFrame centerCrop(GrayFrame src, float fraction) {
        int side = Math.max(180, Math.round(Math.min(src.width, src.height) * fraction));
        side = Math.min(side, Math.min(src.width, src.height));
        int left = (src.width - side) / 2;
        int top = (src.height - side) / 2;
        byte[] out = new byte[side * side];
        for (int y = 0; y < side; y++) {
            System.arraycopy(src.data, (top + y) * src.width + left, out, y * side, side);
        }
        return new GrayFrame(out, side, side);
    }

    private GrayFrame stretchContrast(GrayFrame src) {
        int[] histogram = new int[256];
        for (byte value : src.data) histogram[value & 0xFF]++;
        int total = src.data.length;
        int lowTarget = Math.max(1, total / 50);
        int highTarget = Math.max(1, total - lowTarget);
        int cumulative = 0;
        int low = 0;
        for (; low < 255; low++) {
            cumulative += histogram[low];
            if (cumulative >= lowTarget) break;
        }
        cumulative = 0;
        int high = 255;
        for (int i = 0; i < 256; i++) {
            cumulative += histogram[i];
            if (cumulative >= highTarget) {
                high = i;
                break;
            }
        }
        if (high - low < 24) return src;
        int range = high - low;
        byte[] out = new byte[src.data.length];
        for (int i = 0; i < src.data.length; i++) {
            int v = src.data[i] & 0xFF;
            int mapped = (v - low) * 255 / range;
            if (mapped < 0) mapped = 0;
            else if (mapped > 255) mapped = 255;
            out[i] = (byte) mapped;
        }
        return new GrayFrame(out, src.width, src.height);
    }

    private GrayFrame otsuThreshold(GrayFrame src) {
        int[] histogram = new int[256];
        long sum = 0;
        for (byte value : src.data) {
            int v = value & 0xFF;
            histogram[v]++;
            sum += v;
        }
        int total = src.data.length;
        int backgroundWeight = 0;
        long backgroundSum = 0;
        double bestVariance = -1;
        int threshold = 127;
        for (int t = 0; t < 256; t++) {
            backgroundWeight += histogram[t];
            if (backgroundWeight == 0) continue;
            int foregroundWeight = total - backgroundWeight;
            if (foregroundWeight == 0) break;
            backgroundSum += (long) t * histogram[t];
            double backgroundMean = (double) backgroundSum / backgroundWeight;
            double foregroundMean = (double) (sum - backgroundSum) / foregroundWeight;
            double diff = backgroundMean - foregroundMean;
            double variance = (double) backgroundWeight * foregroundWeight * diff * diff;
            if (variance > bestVariance) {
                bestVariance = variance;
                threshold = t;
            }
        }
        byte[] out = new byte[src.data.length];
        for (int i = 0; i < src.data.length; i++) {
            out[i] = (byte) (((src.data[i] & 0xFF) <= threshold) ? 0 : 255);
        }
        return new GrayFrame(out, src.width, src.height);
    }

    private GrayFrame scaleNearest(GrayFrame src, float scale) {
        int newWidth = Math.max(src.width, Math.round(src.width * scale));
        int newHeight = Math.max(src.height, Math.round(src.height * scale));
        byte[] out = new byte[newWidth * newHeight];
        for (int y = 0; y < newHeight; y++) {
            int sy = Math.min(src.height - 1, (int) (y / scale));
            int sourceRow = sy * src.width;
            int targetRow = y * newWidth;
            for (int x = 0; x < newWidth; x++) {
                int sx = Math.min(src.width - 1, (int) (x / scale));
                out[targetRow + x] = src.data[sourceRow + sx];
            }
        }
        return new GrayFrame(out, newWidth, newHeight);
    }

    private void deliverResult(String result, byte[] rawBytes) {
        if (cameraProvider != null) cameraProvider.unbindAll();
        Intent data = new Intent(Intents.Scan.ACTION);
        data.putExtra(Intents.Scan.RESULT, result);
        data.putExtra(Intents.Scan.RESULT_FORMAT, "QR_CODE");
        if (rawBytes != null && rawBytes.length > 0) {
            data.putExtra(Intents.Scan.RESULT_BYTES, rawBytes);
        }
        setResult(Activity.RESULT_OK, data);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (mlKitScanner != null) mlKitScanner.close();
        if (analyzerExecutor != null) analyzerExecutor.shutdownNow();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class DecodedQr {
        final String text;
        final byte[] rawBytes;

        DecodedQr(String text, byte[] rawBytes) {
            this.text = text;
            this.rawBytes = rawBytes;
        }
    }

    private static final class GrayFrame {
        final byte[] data;
        final int width;
        final int height;

        GrayFrame(byte[] data, int width, int height) {
            this.data = data;
            this.width = width;
            this.height = height;
        }
    }
}
