package com.transportlog.proapp;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.util.AttributeSet;

import com.journeyapps.barcodescanner.ViewfinderView;

/**
 * The stock ZXing CaptureActivity and BarcodeView still perform all scanning.
 * Only the viewfinder drawing changes: show one square rather than a laser line.
 * Do not change BarcodeView's framing rect or decoder crop.
 */
public class SquareQrViewfinderView extends ViewfinderView {
    private final Paint shade = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint outline = new Paint(Paint.ANTI_ALIAS_FLAG);

    public SquareQrViewfinderView(Context context, AttributeSet attrs) {
        super(context, attrs);
        shade.setStyle(Paint.Style.FILL);
        shade.setColor(Color.argb(92, 0, 0, 0));
        outline.setStyle(Paint.Style.STROKE);
        outline.setStrokeWidth(dp(3));
        outline.setStrokeJoin(Paint.Join.ROUND);
        outline.setColor(Color.rgb(22, 196, 106));
    }

    @Override
    public void onDraw(Canvas canvas) {
        // This is only a visual guide. The native decoder sees its original,
        // larger framing rectangle, so this view cannot crop readable QR data.
        Rect originalFrame = cameraPreview == null ? null : cameraPreview.getFramingRect();
        if (originalFrame == null) return;

        float maxSide = Math.min(originalFrame.width(), originalFrame.height()) - dp(8);
        float side = Math.min(dp(240), maxSide);
        if (side <= dp(40)) return;

        float cx = originalFrame.exactCenterX();
        float cy = originalFrame.exactCenterY();
        float left = cx - side / 2f;
        float top = cy - side / 2f;
        float right = cx + side / 2f;
        float bottom = cy + side / 2f;

        // Lightly darken the area outside the clearly visible square.
        canvas.drawRect(0, 0, getWidth(), top, shade);
        canvas.drawRect(0, bottom, getWidth(), getHeight(), shade);
        canvas.drawRect(0, top, left, bottom, shade);
        canvas.drawRect(right, top, getWidth(), bottom, shade);
        canvas.drawRoundRect(left, top, right, bottom, dp(14), dp(14), outline);
    }

    private float dp(int value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
