CREATE TABLE playlist_related_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  members TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE playlist_related_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon" ON playlist_related_groups
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO playlist_related_groups (name, members) VALUES
  ('Виталий Ефремочкин', ARRAY['Виталий Ефремочкин','Новое поколение (Харьков)','Jesus Fans music']),
  ('ц.Слово Жизни (Москва)', ARRAY['ц.Слово Жизни (Москва)','ц.Слово Жизни Youth (Москва)','Карен Карагян','Слово Жизни Music','Wolrus WORSHIP']),
  ('4U Band', ARRAY['4U Band','NG (Мелитополь)','M.Worship']),
  ('Филипп Реннер', ARRAY['Филипп Реннер','Rennerworship']),
  ('Imprint', ARRAY['Imprint','Imprintband']),
  ('SokolovBrothers', ARRAY['SokolovBrothers','Александр Соколов','Владимир Соколов']),
  ('Дарина Кочанжи', ARRAY['Дарина Кочанжи','Дарина Кочанжи и Александр Логвиненко']),
  ('Сергей Брикса', ARRAY['Сергей Брикса','Brikca & friends']),
  ('ц.Краеугольный Камень (Новосибирск)', ARRAY['ц.Краеугольный Камень (Новосибирск)','ц.Краеугольный Камень (Новосибирск) & Наталья Доценко']),
  ('Granula Grace & friends', ARRAY['Granula Grace & friends','Granula Grace']),
  ('NG Worship', ARRAY['NG Worship','Новое Поколение (Рига)','Новое Поколение']),
  ('Денис & Анастасия Никитины', ARRAY['Денис & Анастасия Никитины','Денис Никитин']),
  ('Евгений и Леонид Колокольчиковы', ARRAY['Евгений и Леонид Колокольчиковы','Евгений Колокольчиков & Леонид Колокольчиков']),
  ('Кристина Кобрин', ARRAY['Кристина Кобрин','Кристина Кобрин, Сергей Дастик','Новое Поколение (Барановичи)','NG (Барановичи)']),
  ('Павел Мурашов feat. Rasma', ARRAY['Павел Мурашов feat. Rasma','Павел Мурашов и Мария Ледяева']),
  ('ц.Вифания (Краснодар)', ARRAY['ц.Вифания (Краснодар)','ц.Вифания']),
  ('Явление', ARRAY['Явление','Явление Music']),
  ('Hillsong (Киев)', ARRAY['Hillsong (Киев)','Hillsong НА РУССКОМ ЯЗЫКЕ']);
