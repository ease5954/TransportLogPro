package com.transportlog.proapp;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.Size;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
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

/**
 * High-resolution scanner shared by Hanil Yeongwol and Ssangyong Bukpyeong.
 * CameraX keeps the analysis frame near 1920x1080 and ZBar scans the upright
 * luminance frame at density 1 so dense or small printed receipt QRs are not
 * lost by aggressive down-scaling.
 */
public class CustomQrCaptureActivity extends ComponentActivity {
    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService analyzerExecutor;
    private ImageScanner imageScanner;
    private volatile boolean resultDelivered;
    private volatile long lastAnalysisMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);

        imageScanner = new ImageScanner();
        imageScanner.setConfig(0, Config.X_DENSITY, 1);
        imageScanner.setConfig(0, Config.Y_DENSITY, 1);
        analyzerExecutor = Executors.newSingleThreadExecutor();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        previewView = new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
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
        title.setText("한일 영월 · 쌍용 북평 전용 HD QR 스캔\nQR 네 모서리가 사각형 안에 모두 보이게 맞춰주세요");
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
        hint.setText("권장 거리 15~25cm · 빛 반사 없이 1~2초 고정");
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
                cameraProvider.bindToLifecycle(
                        this,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis
                );
            } catch (Exception error) {
                Toast.makeText(this, "HD QR 카메라 실행 실패: " + error.getMessage(), Toast.LENGTH_LONG).show();
                setResult(Activity.RESULT_CANCELED);
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void analyzeFrame(ImageProxy proxy) {
        try {
            if (resultDelivered) return;
            long now = System.currentTimeMillis();
            if (now - lastAnalysisMs < 300) return;
            lastAnalysisMs = now;

            GrayFrame raw = copyLuma(proxy);
            int rotation = proxy.getImageInfo().getRotationDegrees();
            GrayFrame upright = rotate(raw, rotation);

            String result = scan(upright);
            if (result == null) result = scan(centerCrop(upright, 0.90f));
            if (result == null) result = scan(centerCrop(upright, 0.78f));
            if (result == null) result = scan(centerCrop(upright, 0.66f));

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
        ByteBuffer buffer = plane.getBuffer();
        int rowStride = plane.getRowStride();
        int pixelStride = plane.getPixelStride();
        byte[] out = new byte[width * height];

        if (pixelStride == 1 && rowStride == width) {
            buffer.rewind();
            buffer.get(out, 0, Math.min(out.length, buffer.remaining()));
            return new GrayFrame(out, width, height);
        }

        byte[] row = new byte[rowStride];
        for (int y = 0; y < height; y++) {
            buffer.position(y * rowStride);
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
