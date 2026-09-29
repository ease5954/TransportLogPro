package com.transportlog.proapp;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.DecodeHintType;
import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;
import com.journeyapps.barcodescanner.Size;
import com.journeyapps.barcodescanner.camera.CameraSettings;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * High-density QR scanner for thermal cement slips.
 * The green square is only a guide; the decoder uses a substantially larger camera area.
 */
public class CustomQrCaptureActivity extends CaptureActivity {
    private DecoratedBarcodeView scannerView;

    @Override
    protected DecoratedBarcodeView initializeContent() {
        scannerView = super.initializeContent();

        // Hide ZXing's laser and draw one clear square guide instead.
        scannerView.getViewFinder().setLaserVisibility(false);
        scannerView.getViewFinder().setVisibility(View.INVISIBLE);

        View guide = new View(this);
        GradientDrawable border = new GradientDrawable();
        border.setColor(Color.TRANSPARENT);
        border.setStroke(dp(3), Color.rgb(33, 196, 107));
        border.setCornerRadius(dp(16));
        guide.setBackground(border);
        guide.setClickable(false);
        guide.setFocusable(false);

        int width = getResources().getDisplayMetrics().widthPixels;
        int size = Math.min(dp(330), width - dp(28));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(size, size);
        params.gravity = Gravity.CENTER;
        scannerView.addView(guide, params);
        return scannerView;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // CaptureActivity has already consumed Intent settings at this point.
        // Override them before onResume() opens the camera.
        CameraSettings camera = new CameraSettings();
        camera.setAutoFocusEnabled(true);
        camera.setContinuousFocusEnabled(true);
        camera.setMeteringEnabled(true);
        camera.setExposureEnabled(true);
        camera.setBarcodeSceneModeEnabled(true);
        scannerView.setCameraSettings(camera);

        // Decode almost the whole preview. Dense receipt QR codes become difficult
        // when the default crop is too small, even though they look centered to users.
        int width = getResources().getDisplayMetrics().widthPixels;
        int frame = Math.max(dp(280), width - dp(20));
        scannerView.getBarcodeView().setFramingRectSize(new Size(frame, frame));

        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        scannerView.setDecoderFactory(new DefaultDecoderFactory(
                Collections.singletonList(BarcodeFormat.QR_CODE),
                hints,
                "MS949",
                2
        ));
        scannerView.setStatusText("쌍용 QR은 가까이 비추고 사각형을 가득 채워주세요");
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
