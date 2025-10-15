-- Fix production database schema
-- Chạy script này trực tiếp trên production database

-- Bước 1: Xóa record migration cũ
DELETE FROM migrations WHERE name = 'InitialSchema1700000000000';

-- Bước 2: Xóa bảng ptz_logs cũ (nếu không có data quan trọng)
DROP TABLE IF EXISTS ptz_logs CASCADE;

-- Sau khi chạy script này, restart app để TypeORM tự chạy lại migration
-- App sẽ tự tạo lại bảng ptz_logs với schema đầy đủ
