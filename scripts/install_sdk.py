"""安装 Android SDK 组件"""
import subprocess, os

ANDROID_HOME = os.path.expandvars(r"C:\Users\32066\android-sdk")
JAVA_HOME = r"C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"
SDKMANAGER = os.path.join(ANDROID_HOME, "cmdline-tools", "latest", "bin", "sdkmanager.bat")

env = os.environ.copy()
env["ANDROID_HOME"] = ANDROID_HOME
env["JAVA_HOME"] = JAVA_HOME
env["PATH"] = JAVA_HOME + "\\bin;" + env["PATH"]

def run(cmd_args):
    print(f"[RUN] sdkmanager {' '.join(cmd_args)}")
    proc = subprocess.Popen(
        [SDKMANAGER, "--sdk_root=" + ANDROID_HOME] + cmd_args,
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    # Auto-accept everything
    stdout, _ = proc.communicate(input="y\ny\ny\ny\ny\ny\ny\ny\n")
    print(stdout[-2000:] if len(stdout) > 2000 else stdout)
    return proc.returncode == 0

print("=== Accepting licenses ===")
run(["--licenses"])

print("\n=== Installing SDK packages ===")
ok = run(["platform-tools", "platforms;android-36", "platforms;android-34", "build-tools;36.1.0"])

if ok:
    print("\n[DONE] Android SDK components installed successfully.")
else:
    print("\n[ERROR] SDK installation failed.")
