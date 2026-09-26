package com.transportlog.proapp;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;

/**
 * Keep the library's proven camera + decoder settings, with a square guide only.
 * The previous implementation reduced the actual decode frame to 250dp and could
 * miss a QR code even when it was visible in the camera preview.
 */
public class CustomQrCaptureActivity extends CaptureActivity {
    @Override
    protected DecoratedBarcodeView initializeContent() {
        DecoratedBarcodeView scannerView = super.initializeContent();

        // This only changes the visual guide: do not crop the decoder preview.
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
        int size = Math.min(dp(240), width - dp(48));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(size, size);
        params.gravity = Gravity.CENTER;
        scannerView.addView(guide, params);
        return scannerView;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
