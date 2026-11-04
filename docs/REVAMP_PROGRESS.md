# Tiến độ lột xác hình ảnh

Nhánh: `revamp/visual`. Đọc file này trước khi làm tiếp.

## Đã xong
- [x] Giai đoạn 0: khảo sát, `tools/baseline-hashes.json` (48 hash), `tools/hash-check.js`, `tools/shots.js`, `tools/fps.js`,
      ảnh `docs/screenshots/before/`, `docs/REVAMP_PLAN.md`.

## Đang làm
- Giai đoạn 1: nền tảng responsive.

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
