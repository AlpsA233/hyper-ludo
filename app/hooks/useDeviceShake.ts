import { useEffect, useRef, useState } from "react";

interface UseDeviceShakeOptions {
  threshold?: number; // 加速度阈值，默认 25
  cooldown?: number; // 冷却时间（ms），默认 1000
  shakeEndDelay?: number; // 停止摇动后的延迟时间（ms），默认 300
  onShake?: () => void; // 摇一摇回调
  enabled?: boolean; // 是否启用，默认 true
}

export function useDeviceShake(options: UseDeviceShakeOptions = {}) {
  const {
    threshold = 25,
    cooldown = 1000,
    shakeEndDelay = 300,
    onShake,
    enabled = true,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const lastShakeTime = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);
  const isShaking = useRef(false);
  const shakeEndTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 检查浏览器支持
    if (typeof window === "undefined" || !window.DeviceMotionEvent) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // 对于非iOS或旧版iOS，直接设置为已授权
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission !== "function"
    ) {
      setIsPermissionGranted(true);
    }

    // 监听输入框焦点，避免与系统功能冲突
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        setIsInputFocused(false);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (
      !isSupported ||
      !isPermissionGranted ||
      !onShake ||
      !enabled ||
      isInputFocused
    ) {
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = Date.now();

      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;

      // 计算加速度变化
      const deltaX = Math.abs(x - lastX.current);
      const deltaY = Math.abs(y - lastY.current);
      const deltaZ = Math.abs(z - lastZ.current);

      // 如果任意轴的变化超过阈值，认为正在摇动
      if (deltaX > threshold || deltaY > threshold || deltaZ > threshold) {
        // 清除之前的停止计时器
        if (shakeEndTimer.current) {
          clearTimeout(shakeEndTimer.current);
          shakeEndTimer.current = null;
        }

        // 标记为正在摇动
        if (!isShaking.current) {
          isShaking.current = true;
        }

        // 设置新的停止计时器（停止摇动后触发）
        shakeEndTimer.current = setTimeout(() => {
          // 检查冷却时间
          if (current - lastShakeTime.current >= cooldown) {
            lastShakeTime.current = Date.now();

            // 触发振动反馈
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }

            onShake();
          }

          isShaking.current = false;
        }, shakeEndDelay);
      }

      // 更新上一次的值
      lastX.current = x;
      lastY.current = y;
      lastZ.current = z;
    };

    // 页面可见性变化时停止监听
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (shakeEndTimer.current) {
          clearTimeout(shakeEndTimer.current);
          shakeEndTimer.current = null;
        }
        isShaking.current = false;
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (shakeEndTimer.current) {
        clearTimeout(shakeEndTimer.current);
      }
    };
  }, [
    isSupported,
    isPermissionGranted,
    onShake,
    threshold,
    cooldown,
    shakeEndDelay,
    enabled,
    isInputFocused,
  ]);

  const requestPermission = async () => {
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        setIsPermissionGranted(permission === "granted");
        return permission === "granted";
      } catch (error) {
        console.error("Motion permission error:", error);
        return false;
      }
    }
    return true;
  };

  return {
    isSupported,
    isPermissionGranted,
    requestPermission,
  };
}
