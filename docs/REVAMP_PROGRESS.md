# Tiến độ lột xác hình ảnh

Nhánh: `revamp/visual`. Đọc file này trước khi làm tiếp.

## Đã xong
- [x] Giai đoạn 0: khảo sát, `tools/baseline-hashes.json` (48 hash), `tools/hash-check.js`, `tools/shots.js`, `tools/fps.js`,
      ảnh `docs/screenshots/before/`, `docs/REVAMP_PLAN.md`.

- [x] Giai đoạn 1: canvas phủ visualViewport + DPR (trần theo chất lượng), thế giới 720 px chiều ngắn tới 21:9 + viền trang trí,
      `render.toView` cho chuột, HUD canvas theo CSS px + vùng an toàn (`--sat/--sar/--sab/--sal`), cụm nút cảm ứng tròn,
      màn xoay ngang + tự tạm dừng, sàn chia khối 512 px thế giới (≤1024 px), cài đặt `quality`, chặn cử chỉ trình duyệt,
      ẩn fullscreen khi không hỗ trợ, ULT trên gamepad = Y, bỏ hệ số "x1.05" giả của combo (không có trong sim).
      Test Acceptance 12 viết lại (gradient chỉ trong `src/fx/art.js`, 'lighter' chỉ trong src/fx, không tạo gradient sau warm-up).

## Đang làm
- Giai đoạn 2: lát cắt mẫu (scrap, ranger, grunt/swarmer/spitter, pistol, HUD, màn lên cấp).

## Quyết định đã chốt
- Font: Baloo 2 ExtraBold (tiêu đề) + Be Vietnam Pro Medium/Bold (nội dung), OFL, subset Latin+Việt, base64 trong `css/fonts.css`.
- Thêm đúng một file fx mới `src/fx/art.js` (token + nướng sprite + ánh sáng), nạp ngay sau `shapes.js`.
- Thân nhân vật/quái không xoay theo hướng ngắm, chỉ lật trái/phải; vũ khí + mắt theo hướng ngắm.
- Vùng cấm cũ "opacity/rgba" trong CSS được bỏ (cần cho chuyển cảnh/lớp phủ), vẫn cấm blur/filter/backdrop/blend.
- Cổng xoay ngang áp dụng cho mọi thiết bị khi khung nhìn dọc (tỉ lệ < 1) trong lúc đánh.

## Ghi chú baseline
- `node tests/run.js`: 107/107. `--strict-events`: 106/107 ngay từ baseline (bot 70 s không chạm tới run:end, weapon:evolve,
  chain:arc, area:explode, player:hurt, player:death, boss:phase, boss:death) — lỗi có sẵn, không phải do đợt này.
- Stress (Chromium headless, 1280×720, DPR 1): ~46–51 FPS, render trung bình ~3.0 ms, p95 ~4.7 ms.
