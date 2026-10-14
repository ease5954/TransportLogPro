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
import com.google.zxing.client.android.Intents;
import com.yanzhenjie.zbar.Config;
import com.yanzhenjie.zbar.Image;
import com.yanzhenjie.zbar.ImageScanner;
import com.yanzhenjie.zbar.Symbol;
import com.yanzhenjie.zbar.SymbolSet;

import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * High-resolution scanner shared by Hanil Yeongwol, Ssangyong Bukpyeong and Sampyo.
 *
 * The cement waybill QRs can be small, dense and printed on thermal paper. CameraX
 * keeps the analysis stream near 1920x1080, applies a modest digital zoom, allows
 * tap-to-focus, and feeds several luminance variants to ZBar. Raw frames are always
 * attempted first so the already-working Ssangyong/Sampyo path remains unchanged.
 */
public class CustomQrCaptureActivity extends ComponentActivity {
    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private Camera activeCamera;
    private ExecutorService analyzerExecutor;
    private ImageScanner imageScanner;
    private volatile boolean resultDelivered;
    private volatile long lastAnalysisMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);

        imageScanner = new ImageScanner();
        // Density 1 is intentionally kept: dense thermal-print QR modules were lost
        // with the wrapper's older, sparser scan-line settings.
        imageScanner.setConfig(0, Config.X_DENSITY, 1);
        imageScanner.setConfig(0, Config.Y_DENSITY, 1);
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
        title.setText("운송 QR 고해상도 스캔\n한일 영월 · 쌍용 북평 · 삼표");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        title.setPadding(dp(16), dp(14), dp(16), dp(14));
        title.setBackgroundColor(Color.argb(155, 0, 0, 0));
        FrameLayout.LayoutParams titleParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.gravity = Gravity.TOP;
        titleParams.topMargin = dp(22);
        root.addView(title, titleParams);

        TextView hint = new TextView(this);
        hint.setText("QR 네 모서리를 사각형 안에 맞추고 15~25cm에서 1~2초 고정\n흐리면 QR 부분을 화면에서 한 번 터치하세요");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(15);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(18), dp(12), dp(18), dp(12));
        hint.setBackgroundColor(Color.argb(155, 0, 0, 0));
        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        hintParams.gravity = Gravity.BOTTOM;
        hintParams.bottomMargin = dp(30);
        root.addView(hint, hintParams);

        setContentView(root);
        startHighResolutionCamera();
    }

    private void startHighResolutionCamera() {
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

                // A modest sensor crop makes tiny QR modules larger without forcing
                // the user extremely close, while staying safe on cameras with a low
                // maximum zoom ratio.
                ZoomState zoomState = activeCamera.getCameraInfo().getZoomState().getValue();
                if (zoomState != null) {
                    float targetZoom = Math.min(1.35f, zoomState.getMaxZoomRatio());
                    targetZoom = Math.max(targetZoom, zoomState.getMinZoomRatio());
                    activeCamera.getCameraControl().setZoomRatio(targetZoom);
                }

                // Trigger one center focus after the preview has settled. Continuous
                // AF continues normally afterward, and the user can tap the QR area.
                previewView.postDelayed(() -> focusAt(
                        previewView.getWidth() / 2f,
                        previewView.getHeight() / 2f
                ), 450);
            } catch (Exception error) {
                Toast.makeText(this, "HD QR 카메라 실행 실패: " + error.getMessage(), Toast.LENGTH_LONG).show();
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
            // Some camera implementations do not expose metering regions. Scanning
            // should continue with the camera's default continuous autofocus.
        }
    }

    private void analyzeFrame(ImageProxy proxy) {
        try {
            if (resultDelivered) return;
            long now = System.currentTimeMillis();
            if (now - lastAnalysisMs < 180) return;
            lastAnalysisMs = now;

            GrayFrame raw = copyLuma(proxy);
            int rotation = proxy.getImageInfo().getRotationDegrees();
            GrayFrame upright = rotate(raw, rotation);

            String result = scanTransportQr(upright);
            if (result != null && !result.trim().isEmpty()) {
                final String decoded = result;
                resultDelivered = true;
                runOnUiThread(() -> deliverResult(decoded));
            }
        } catch (Throwable ignored) {
            // Keep the camera alive and analyze the next frame.
        } finally {
            proxy.close();
        }
    }

    /**
     * Preserve the successful raw ZBar route first, then add increasingly focused
     * crops and contrast/binarization passes for the difficult Hanil thermal QR.
     */
    private String scanTransportQr(GrayFrame upright) {
        String result = scan(upright);
        if (result != null) return result;

        GrayFrame crop90 = centerCrop(upright, 0.90f);
        result = scan(crop90);
        if (result != null) return result;

        GrayFrame crop78 = centerCrop(upright, 0.78f);
        result = scan(crop78);
        if (result != null) return result;

        GrayFrame crop66 = centerCrop(upright, 0.66f);
        result = scan(crop66);
        if (result != null) return result;

        // Thermal paper frequently has a pale background or localized glare. These
        // passes run only after all raw attempts, so they cannot regress normal QR.
        GrayFrame contrast78 = stretchContrast(crop78);
        result = scan(contrast78);
        if (result != null) return result;
        result = scan(otsuThreshold(contrast78));
        if (result != null) return result;

        GrayFrame contrast66 = stretchContrast(crop66);
        result = scan(contrast66);
        if (result != null) return result;
        result = scan(otsuThreshold(contrast66));
        if (result != null) return result;

        // Nearest-neighbour enlargement can help ZBar lock onto very small finder
        // and timing modules after the QR has been isolated in the center crop.
        return scan(scaleNearest(contrast66, 1.45f));
    }

    private String scan(GrayFrame frame) {
        if (frame == null || frame.width < 200 || frame.height < 200) return null;
        Image barcode = new Image(frame.width, frame.height, "Y800");
        barcode.setData(frame.data);
        int found = imageScanner.scanImage(barcode);
        if (found == 0) return null;
        SymbolSet symbols = imageScanner.getResults();
        for (Symbol symbol : symbols) {
            String data = symbol.getData();
            if (data != null && !data.trim().isEmpty()) return data;
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
        byte[] out = new byte[width * height];
        int base = buffer.position();

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
                    int srcIndex = y * src.width + x;
                    int nx;
                    int ny;
                    if (d == 90) {
                        nx = src.height - 1 - y;
                        ny = x;
                    } else {
                        nx = y;
                        ny = src.width - 1 - x;
                    }
                    out[ny * nw + nx] = src.data[srcIndex];
                }
            }
            return new GrayFrame(out, nw, nh);
        }
        return src;
    }

    private GrayFrame centerCrop(GrayFrame src, float fraction) {
        int side = Math.max(200, Math.round(Math.min(src.width, src.height) * fraction));
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
        int lowTarget = Math.max(1, total / 50);   // 2%
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
        byte[] out = new byte[src.data.length];
        int range = high - low;
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
        int weightBackground = 0;
        long sumBackground = 0;
        double bestVariance = -1;
        int threshold = 127;
        for (int t = 0; t < 256; t++) {
            weightBackground += histogram[t];
            if (weightBackground == 0) continue;
            int weightForeground = total - weightBackground;
            if (weightForeground == 0) break;
            sumBackground += (long) t * histogram[t];
            double meanBackground = (double) sumBackground / weightBackground;
            double meanForeground = (double) (sum - sumBackground) / weightForeground;
            double diff = meanBackground - meanForeground;
            double variance = (double) weightBackground * weightForeground * diff * diff;
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
        if (scale <= 1.01f) return src;
        int newWidth = Math.max(src.width, Math.round(src.width * scale));
        int newHeight = Math.max(src.height, Math.round(src.height * scale));
        byte[] out = new byte[newWidth * newHeight];
        for (int y = 0; y < newHeight; y++) {
            int sy = Math.min(src.height - 1, (int) (y / scale));
            int srcRow = sy * src.width;
            int dstRow = y * newWidth;
            for (int x = 0; x < newWidth; x++) {
                int sx = Math.min(src.width - 1, (int) (x / scale));
                out[dstRow + x] = src.data[srcRow + sx];
            }
        }
        return new GrayFrame(out, newWidth, newHeight);
    }

    private void deliverResult(String result) {
        if (cameraProvider != null) cameraProvider.unbindAll();
        Intent data = new Intent(Intents.Scan.ACTION);
        data.putExtra(Intents.Scan.RESULT, result);
        data.putExtra(Intents.Scan.RESULT_FORMAT, "QR_CODE");
        setResult(Activity.RESULT_OK, data);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (analyzerExecutor != null) analyzerExecutor.shutdownNow();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
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
