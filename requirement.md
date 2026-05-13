# Generate Content App

1. Authentication

- Dùng email, password để đăng nhập
- Lưu các thông tin người dùng như: tên, email, password, số điện thoại

2. Quản lý credit của user

---

- Đơn vị: Credit
  Ví dụ: 20 credit

---

Ghi nhận lịch sử tiêu thụ credit của user để dễ monitor

3. Cách tính toán credit tiêu thụ của user

---

- Mỗi 1 step trong workflow sẽ được tính toán credit theo cách basic nhất:
    - Đối với chọn đoạn văn ngắn: tốn 0.2 credit/workflow step
    - Đối với chọn đoạn văn vừa: tốn 0.4 credit/workflow step
    - Đối với chọn đoạn văn dài: tốn 1.0 credit/workflow step
      Ví dụ full 1 flow gồm 4 step: - 4 _ 0.2 = 0.8 credit / workflow với bài viết ngắn - 4 _ 0.4 = 1.6 credit / workflow với bài viết vừa - 4 \* 1.0 = 4.0 credit / workflow với bài viết dài

4. Lưu trữ nội dung bài viết, các input, output đã xử lý trong 1 workflow
   Cho phép user xem lại các chỗ input, output này

5. Tích hợp lưu trữ hình ảnh được tạo ra từ bước 4 ở cloudflare r2

---

Techstack:

- Fullstack: Nextjs
- Database: Postgres
- ORM: Prisma
- Cloud Storage: Cloudflare R2
- Deploy: Vercel
