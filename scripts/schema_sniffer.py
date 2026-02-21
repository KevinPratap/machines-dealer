import re

sql_file = r"C:\Users\prata\Downloads\CPanelBackupMachineDealer\backup-2.11.2026_18-38-44_machi3d3\mysql\machi3d3_laravel.sql"
tables_to_find = ['pages', 'blogs', 'videos', 'our_staff', 'spare_parts', 'faqs']

def sniff_schema(file_path, tables):
    schemas = {}
    current_table = None
    cols = []
    
    print(f"Sniffing schemas for: {tables}")
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            create_match = re.search(r"CREATE TABLE `(\w+)`", line)
            if create_match:
                table_name = create_match.group(1)
                if table_name in tables:
                    current_table = table_name
                    cols = []
                    continue
            
            if current_table:
                if line.strip().startswith(')') or line.strip().startswith('ENGINE'):
                    schemas[current_table] = cols
                    current_table = None
                    if len(schemas) == len(tables):
                        break
                else:
                    col_match = re.search(r"`(\w+)`", line)
                    if col_match:
                        cols.append(col_match.group(1))
    
    return schemas

if __name__ == "__main__":
    result = sniff_schema(sql_file, tables_to_find)
    for table, columns in result.items():
        print(f'"{table}": {columns},')
