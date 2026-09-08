## 学习区架构更新

本次更新引入了一个新表 `focus_sessions`，用于存储学习区功能的数据。

### SQL 语句

```sql
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 操作说明

要应用此更新，请对您的 SQLite 数据库执行上述 SQL 语句。这将创建新的 `focus_sessions` 表，使学习区功能能够存储会话数据。
