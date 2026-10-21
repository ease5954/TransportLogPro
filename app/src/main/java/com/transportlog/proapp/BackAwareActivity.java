package com.transportlog.proapp;

import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Toast;

public class BackAwareActivity extends MainActivity {
    private static final long EXIT_CONFIRM_WINDOW_MS = 2000L;
    private long lastHomeBackPressedAt = 0L;

    @Override
    public void onBackPressed() {
        WebView webView = findWebView(getWindow().getDecorView());
        if (webView == null) {
            handleHomeBackPress();
            return;
        }

        webView.evaluateJavascript(
                "(function(){"
                        + "var drawer=document.getElementById('drawer');"
                        + "if(drawer&&drawer.classList.contains('show')){drawer.classList.remove('show');return 'closed';}"
                        + "var insurance=document.getElementById('insurance');"
                        + "if(insurance&&insurance.classList.contains('show')){if(typeof closeInsurance==='function')closeInsurance();else insurance.classList.remove('show');return 'closed';}"
                        + "var appInfo=document.getElementById('appInfo');"
                        + "if(appInfo&&appInfo.classList.contains('show')){if(typeof closeAppInfo==='function')closeAppInfo();else appInfo.classList.remove('show');return 'closed';}"
                        + "var rateModal=document.getElementById('rateModal');"
                        + "if(rateModal&&rateModal.classList.contains('show')){if(typeof closeRateModal==='function')closeRateModal();else rateModal.classList.remove('show');return 'closed';}"
                        + "var active=document.querySelector('.screen.active');"
                        + "if(active&&active.id&&active.id!=='home'){if(typeof go==='function'){go('home');return 'home';}}"
                        + "return 'at_home';"
                        + "})()",
                value -> {
                    if ("\"closed\"".equals(value) || "\"home\"".equals(value)) {
                        lastHomeBackPressedAt = 0L;
                        return;
                    }
                    handleHomeBackPress();
                }
        );
    }

    private void handleHomeBackPress() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastHomeBackPressedAt <= EXIT_CONFIRM_WINDOW_MS) {
            finish();
            return;
        }
        lastHomeBackPressedAt = now;
        Toast.makeText(this, "한 번 더 누르면 앱이 종료됩니다.", Toast.LENGTH_SHORT).show();
    }

    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
}
