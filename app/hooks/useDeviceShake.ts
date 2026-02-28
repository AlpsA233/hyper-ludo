import { useEffect, useRef, useState } from "react";

interface UseDeviceShakeOptions {
  threshold?: number; // 加速度阈值，默认 25
  cooldown?: number; // 冷却时间（ms），默认 500
  onShake?: () => void; // 摇一摇回调
}

export function useDeviceShake(options: UseDeviceShakeOptions = {}) {
  const { threshold = 25, cooldown = 500, onShake } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const lastShakeTime = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);

  useEffect(() => {
    // 检查浏览器支持
    if (typeof window === "undefined" || !window.DeviceMotionEvent) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // iOS 13+ 需要请求权限
    const requestPermission = async () => {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof (DeviceMotionEvent as any).requestPermission === "function"
      ) {
        try {
          const permission = await (
            DeviceMotionEvent as any
          ).requestPermission();
          setIsPermissionGranted(permission === "granted");
        } catch (error) {
          console.error("Motion permission error:", error);
          setIsPermissionGranted(false);
        }
      } else {
        // Android 或旧版 iOS，直接支持
        setIsPermissionGranted(true);
      }
    };

    requestPermission();
  }, []);

  useEffect(() => {
    if (!isSupported || !isPermissionGranted || !onShake) {
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = Date.now();

      // 冷却时间检查
      if (current - lastShakeTime.current < cooldown) {
        return;
      }

      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;

      // 计算加速度变化
      const deltaX = Math.abs(x - lastX.current);
      const deltaY = Math.abs(y - lastY.current);
      const deltaZ = Math.abs(z - lastZ.current);

      // 如果任意轴的变化超过阈值，认为是摇一摇
      if (deltaX > threshold || deltaY > threshold || deltaZ > threshold) {
        lastShakeTime.current = current;

        // 触发振动反馈
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        onShake();
      }

      // 更新上一次的值
      lastX.current = x;
      lastY.current = y;
      lastZ.current = z;
    };

    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [isSupported, isPermissionGranted, onShake, threshold, cooldown]);

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
