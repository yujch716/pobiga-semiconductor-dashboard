import sqlite3
import pandas as pd

df = pd.read_csv("data/modeling_merged.csv")
conn = sqlite3.connect("data/modeling_merged.db")

df.to_sql("modeling_merged", conn, if_exists="replace", index=False)
print(f"modeling_merged -> {len(df)}행 저장")

conn.close()
