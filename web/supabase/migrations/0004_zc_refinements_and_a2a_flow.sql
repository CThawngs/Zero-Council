-- Zero Council Refinements & A2A Hermes Flow: Constraints, Turn Order, Session Control, and Mentioning
-- 
-- Shared contract: applies in order after 0001_zc_orders.sql, 0002_zc_coupons.sql, and 0003_zc_core_schema.sql.
-- Apply with the Supabase CLI (`supabase db push`) or paste into Supabase dashboard SQL Editor.
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 1. Bổ sung thứ tự phát biểu (turn_order) cho Tranh luận vòng
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.zc_participants 
  ADD COLUMN IF NOT EXISTS turn_order integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.zc_participants.turn_order IS 
  'Thứ tự lượt nói mặc định của AI trong phiên tranh luận (Round Debate / Turn Order).';


-- ---------------------------------------------------------------------------------------------
-- 2. Gán ràng buộc NOT NULL cho system_prompt và decision_lens trong zc_agents
-- ---------------------------------------------------------------------------------------------
-- Backfill dữ liệu NULL thành prompt/lens mặc định trước khi siết constraint
UPDATE public.zc_agents 
SET system_prompt = 'You are a helpful AI council advisor.' 
WHERE system_prompt IS NULL;

ALTER TABLE public.zc_agents 
  ALTER COLUMN system_prompt SET NOT NULL;

UPDATE public.zc_agents 
SET decision_lens = 'General Analysis' 
WHERE decision_lens IS NULL;

ALTER TABLE public.zc_agents 
  ALTER COLUMN decision_lens SET NOT NULL;


-- ---------------------------------------------------------------------------------------------
-- 3. Siết chặt các khóa ngoại bắt buộc (NOT NULL constraints)
-- ---------------------------------------------------------------------------------------------
-- Công cụ phải thuộc về một Agent cụ thể
ALTER TABLE public.zc_agent_tools 
  ALTER COLUMN agent_id SET NOT NULL;

-- API key bắt buộc phải thuộc về một User cụ thể
ALTER TABLE public.zc_users_api_keys 
  ALTER COLUMN user_id SET NOT NULL;

-- Cuộc trò chuyện bắt buộc phải do một User sở hữu
ALTER TABLE public.zc_conversations 
  ALTER COLUMN user_id SET NOT NULL;

-- Tin nhắn bắt buộc phải thuộc về một Conversation
ALTER TABLE public.zc_messages 
  ALTER COLUMN conversation_id SET NOT NULL;

-- File đính kèm bắt buộc phải gắn với một Tin nhắn
ALTER TABLE public.zc_message_attachments 
  ALTER COLUMN message_id SET NOT NULL;

-- Model AI bắt buộc phải thuộc về một Provider
ALTER TABLE public.zc_agent_models 
  ALTER COLUMN provider_id SET NOT NULL;


-- ---------------------------------------------------------------------------------------------
-- 4. Điều khiển Trạng thái Tranh luận (A2A & Hermes Mode Loop Control)
-- ---------------------------------------------------------------------------------------------
-- Mở rộng danh sách trạng thái status trong zc_conversations (bổ sung Paused và Cancelled)
ALTER TABLE public.zc_conversations 
  DROP CONSTRAINT IF EXISTS zc_conversations_status_check;

ALTER TABLE public.zc_conversations 
  ADD CONSTRAINT zc_conversations_status_check 
  CHECK (status IN ('Active', 'Deliberating', 'Paused', 'Concluded', 'Cancelled'));

-- Chỉ định Agent tiếp theo được phép phát biểu (phục vụ A2A @mention hoặc lượt kế tiếp)
ALTER TABLE public.zc_conversations 
  ADD COLUMN IF NOT EXISTS next_speaker_agent_id uuid REFERENCES public.zc_agents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zc_conversations.next_speaker_agent_id IS 
  'ID của Agent tiếp theo được chỉ định trả lời (do A2A @mention hoặc turn_order).';

-- ---------------------------------------------------------------------------------------------
-- 5. Định danh Mention (@mention) trong Tin nhắn
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.zc_messages 
  ADD COLUMN IF NOT EXISTS mentioned_agent_id uuid REFERENCES public.zc_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentions_user boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.zc_messages.mentioned_agent_id IS 
  'ID của Agent được Bot trước đó mention qua @Name.';

COMMENT ON COLUMN public.zc_messages.mentions_user IS 
  'Đánh dấu true nếu Bot kết thúc câu trả lời bằng việc @user để hỏi ý kiến người dùng.';

-- ---------------------------------------------------------------------------------------------
-- 6. Thay ràng buộc model bằng provider trong API
-- ---------------------------------------------------------------------------------------------
-- Đổi tên cột từ model_id sang provider_id
ALTER TABLE public.zc_users_api_keys 
  RENAME COLUMN model_id TO provider_id;

-- Xóa ràng buộc cũ nếu lỡ tạo sai tên
ALTER TABLE public.zc_users_api_keys 
  DROP CONSTRAINT IF EXISTS zc_users_api_keys_user_provider_unique;

-- Thêm ràng buộc unique kết hợp giữa user_id và provider_id
ALTER TABLE public.zc_users_api_keys 
  ADD CONSTRAINT zc_users_api_keys_user_provider_unique 
  UNIQUE (user_id, provider_id);

-- Xóa ràng buộc khóa ngoại cũ (trỏ tới zc_agent_models)
ALTER TABLE public.zc_users_api_keys 
  DROP CONSTRAINT IF EXISTS fk_api_keys_model;

-- Bổ sung ràng buộc khóa ngoại mới (trỏ tới zc_agent_providers)
ALTER TABLE public.zc_users_api_keys 
  ADD CONSTRAINT fk_api_keys_provider 
  FOREIGN KEY (provider_id) 
  REFERENCES public.zc_agent_providers(id) 
  ON DELETE CASCADE;

-- Đổi tên index (nếu có) để thống nhất với tên cột mới
ALTER INDEX IF EXISTS zc_users_api_keys_model_idx 
  RENAME TO zc_users_api_keys_provider_idx;
