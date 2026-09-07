package com.transportlog.proapp;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.Size;

public class CustomQrCaptureActivity extends CaptureActivity {

    @Override
    protected DecoratedBarcodeView initializeContent() {
        DecoratedBarcodeView scannerView = super.initializeContent();

        int frameSize = dp(250);
        scannerView.getBarcodeView().setFramingRectSize(new Size(frameSize, frameSize));
        scannerView.getViewFinder().setLaserVisibility(false);

        View squareFrame = new View(this);
        GradientDrawable frameDrawable = new GradientDrawable();
        frameDrawable.setColor(Color.TRANSPARENT);
        frameDrawable.setStroke(dp(4), Color.rgb(33, 196, 107));
        frameDrawable.setCornerRadius(dp(16));
        squareFrame.setBackground(frameDrawable);
        squareFrame.setClickable(false);
        squareFrame.setFocusable(false);

        FrameLayout.LayoutParams frameParams = new FrameLayout.LayoutParams(frameSize, frameSize);
        frameParams.gravity = Gravity.CENTER;
        scannerView.addView(squareFrame, frameParams);

        return scannerView;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
