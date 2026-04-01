-- 모임 테이블
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 참석자 테이블
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 날짜 범위 테이블
create table if not exists date_ranges (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text check (type in ('available', 'unavailable')) not null,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table rooms enable row level security;
alter table participants enable row level security;
alter table date_ranges enable row level security;

-- 모든 사용자가 rooms를 읽고 생성할 수 있도록 허용
drop policy if exists "Allow public read rooms" on rooms;
drop policy if exists "Allow public insert rooms" on rooms;
create policy "Allow public read rooms" on rooms for select using (true);
create policy "Allow public insert rooms" on rooms for insert with check (true);

-- 모든 사용자가 participants를 읽고 생성할 수 있도록 허용
drop policy if exists "Allow public read participants" on participants;
drop policy if exists "Allow public insert participants" on participants;
create policy "Allow public read participants" on participants for select using (true);
create policy "Allow public insert participants" on participants for insert with check (true);

-- 모든 사용자가 date_ranges를 읽고 생성/삭제할 수 있도록 허용
drop policy if exists "Allow public read date_ranges" on date_ranges;
drop policy if exists "Allow public insert date_ranges" on date_ranges;
drop policy if exists "Allow public delete date_ranges" on date_ranges;
create policy "Allow public read date_ranges" on date_ranges for select using (true);
create policy "Allow public insert date_ranges" on date_ranges for insert with check (true);
create policy "Allow public delete date_ranges" on date_ranges for delete using (true);
