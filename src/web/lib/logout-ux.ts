export interface LogoutPromptCopy {
  description: string;
  confirmText: string;
  cancelText: string;
}

export function logoutPromptCopy(pendingCount: number | null): LogoutPromptCopy {
  if (pendingCount === null) {
    return {
      description: 'Không thể xác định số thay đổi chưa đồng bộ. Đăng xuất sẽ xóa dữ liệu riêng tư và mọi thay đổi đang chờ trên thiết bị. Nếu cần giữ các thay đổi, hãy ở lại và kiểm tra bộ nhớ trình duyệt. Nếu máy chủ chưa xác nhận thu hồi phiên, bạn cần kết nối mạng và thử lại.',
      confirmText: 'Đăng xuất và bỏ thay đổi',
      cancelText: 'Ở lại',
    };
  }
  if (pendingCount > 0) {
    return {
      description: `Bạn còn ${pendingCount} thay đổi chưa đồng bộ. Đăng xuất bây giờ sẽ xóa các thay đổi này khỏi thiết bị và yêu cầu máy chủ thu hồi phiên. Nếu máy chủ chưa xác nhận, bạn cần kết nối mạng và thử lại.`,
      confirmText: 'Đăng xuất và bỏ thay đổi',
      cancelText: 'Ở lại',
    };
  }

  return {
    description: 'Takolio sẽ xóa dữ liệu riêng tư khỏi thiết bị này trước khi yêu cầu máy chủ thu hồi phiên. Nếu máy chủ chưa xác nhận, bạn cần kết nối mạng và thử lại.',
    confirmText: 'Đăng xuất',
    cancelText: 'Hủy',
  };
}
