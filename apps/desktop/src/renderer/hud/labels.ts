import type { JarvisReadSnapshot } from "@iris/jarvis-adapter";
import type { GestureViewState } from "./types.js";

export const connectionLabels: Record<JarvisReadSnapshot["connection"], string> = {
  offline: "Ngoại tuyến",
  connecting: "Đang kết nối",
  sign_in_required: "Cần đăng nhập",
  ready: "Sẵn sàng",
  degraded: "Hoạt động suy giảm",
  reconnecting: "Đang kết nối lại",
};

export const cameraLabels: Record<GestureViewState["camera"], string> = {
  off: "Camera đang tắt",
  requesting: "Đang xin quyền camera",
  active: "Camera cục bộ đang hoạt động",
  paused: "Điều khiển cử chỉ đã tạm dừng",
  error: "Camera không khả dụng",
};

export const gestureLabels: Record<GestureViewState["gesture"], string> = {
  point: "Trỏ và giữ",
  open_palm: "Lòng bàn tay mở",
  closed_fist: "Nắm tay",
  unknown: "Chưa nhận diện",
};
