package com.transportlog.proapp;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.google.zxing.client.android.Intents;
import com.yanzhenjie.zbar.camera.CameraPreview;
import com.yanzhenjie.zbar.camera.ScanCallback;

/**
 * Dedicated ZBar scanner for the dense Ssangyong Bukpyeong thermal-print QR.
 *
 * The same receipt photo is not reliably detected by the Google/ZXing path, while
 * ZBar decodes it. Keep this Activity behind the existing "Ssangyong" fallback
 * button so the normal scanner and the rest of the app remain unchanged.
 */
public class CustomQrCaptureActivity extends Activity {
    private CameraPreview preview;
    private boolean running;
    private boolean resultDelivered;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        preview = new CameraPreview(this);
        preview.setScanCallback(new ScanCallback() {
            @Override
            public void onScanResult(String result) {
                if (resultDelivered || result == null || result.trim().isEmpty()) return;
                resultDelivered = true;
                stopScanner();

                Intent data = new Intent(Intents.Scan.ACTION);
                data.putExtra(Intents.Scan.RESULT, result);
                data.putExtra(Intents.Scan.RESULT_FORMAT, "QR_CODE");
                setResult(RESULT_OK, data);
                finish();
            }
        });
        root.addView(preview, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // The guide is visual only. ZBar analyzes the whole camera frame.
        View guide = new View(this);
        GradientDrawable border = new GradientDrawable();
        border.setColor(Color.TRANSPARENT);
        border.setStroke(dp(4), Color.rgb(33, 196, 107));
        border.setCornerRadius(dp(18));
        guide.setBackground(border);
        guide.setClickable(false);
        guide.setFocusable(false);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int guideSize = Math.min(dp(340), screenWidth - dp(24));
        FrameLayout.LayoutParams guideParams = new FrameLayout.LayoutParams(guideSize, guideSize);
        guideParams.gravity = Gravity.CENTER;
        root.addView(guide, guideParams);

        TextView title = new TextView(this);
        title.setText("쌍용 북평 전용 QR 스캔\nQR을 사각형 안에 크게 맞춰주세요");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        title.setPadding(dp(16), dp(14), dp(16), dp(14));
        title.setBackgroundColor(Color.argb(150, 0, 0, 0));
        FrameLayout.LayoutParams titleParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.gravity = Gravity.TOP;
        titleParams.topMargin = dp(22);
        root.addView(title, titleParams);

        TextView hint = new TextView(this);
        hint.setText("빛 반사를 피하고 QR 전체가 보이도록 15~25cm 거리에서 비춰주세요");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(14);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(18), dp(12), dp(18), dp(12));
        hint.setBackgroundColor(Color.argb(150, 0, 0, 0));
        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        hintParams.gravity = Gravity.BOTTOM;
        hintParams.bottomMargin = dp(30);
        root.addView(hint, hintParams);

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!resultDelivered && !running) {
            running = preview.start();
            if (!running) {
                Toast.makeText(this, "쌍용 QR 카메라를 열 수 없습니다.", Toast.LENGTH_LONG).show();
                setResult(RESULT_CANCELED);
                finish();
            }
        }
    }

    @Override
    protected void onPause() {
        stopScanner();
        super.onPause();
    }

    private void stopScanner() {
        if (preview != null && running) {
            try {
                preview.stop();
            } catch (Exception ignored) {
            }
            running = false;
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
