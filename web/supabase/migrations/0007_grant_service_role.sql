-- zc_users: đọc và tạo user
GRANT SELECT, INSERT
ON TABLE public.zc_users
TO service_role;

-- zc_agents: đọc danh sách agents
GRANT SELECT
ON TABLE public.zc_agents
TO service_role;