package com.dayflow.testdriver;

import android.app.UiAutomation;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;

/** Test-only shell entry point. Android 12/13's dump command uses Display.getSize,
 * which can clip valid accessibility nodes below the app's reduced display area.
 * Keep the OS dumper, but supply the actual screenshot dimensions instead. */
public final class DayflowDump {
  public static void main(String[] args) {
    try { dump(args); System.exit(0); }
    catch (Throwable error) { System.err.println("UI snapshot unavailable: " + error); System.exit(1); }
  }
  private static void dump(String[] args) throws Exception {
    Object shell = Class.forName("com.android.uiautomator.core.UiAutomationShellWrapper")
      .getDeclaredConstructor().newInstance();
    Class<?> type = shell.getClass();
    type.getMethod("connect").invoke(shell);
    try {
      UiAutomation automation = (UiAutomation) type.getMethod("getUiAutomation").invoke(shell);
      try { automation.waitForIdle(100, 1500); } catch (java.util.concurrent.TimeoutException ignored) { }
      AccessibilityNodeInfo root = automation.getRootInActiveWindow();
      long deadline = System.currentTimeMillis() + 1500;
      while (root == null && System.currentTimeMillis() < deadline) {
        Thread.sleep(50); root = automation.getRootInActiveWindow();
      }
      if (root == null) throw new IllegalStateException("No active accessibility window");
      File target = new File(args[0]);
      if (target.exists() && !target.delete()) throw new IllegalStateException("Cannot replace UI snapshot");
      Class.forName("com.android.uiautomator.core.AccessibilityNodeInfoDumper")
        .getMethod("dumpWindowToFile", AccessibilityNodeInfo.class, File.class,
          int.class, int.class, int.class)
        .invoke(null, root, target, 0, Integer.parseInt(args[1]), Integer.parseInt(args[2]));
      if (!target.isFile() || target.length() == 0) throw new IllegalStateException("UI snapshot was not written");
      System.out.println("UI hierarchy dumped to: " + args[0]);
    } finally {
      type.getMethod("disconnect").invoke(shell);
    }
  }
}
