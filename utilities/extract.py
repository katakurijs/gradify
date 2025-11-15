import pdfplumber
import json

PDF_PATH = r'C:\Users\antiz\Desktop\Projects\gradify\utilities\Liste Géologie S5.pdf'
OUTPUT_JSON = "students.json"

def extract_students(filiere):
    students = []

    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()

            for table in tables:
                for row in table:
                    if not row or len(row) < 3:
                        continue

                    apogee = (row[0] or "").strip()
                    last = (row[1] or "").strip()
                    first = (row[2] or "").strip()

                    # Skip header rows and blanks
                    if not apogee.isdigit():
                        continue

                    full_name = f"{last} {first}".replace("\n", " ").replace("  ", " ").strip()

                    students.append({
                        "apogee": apogee,
                        "name": full_name,
                        "filiere": filiere
                    })

    return students


if __name__ == "__main__":
    filiere = input("Enter filiere for this list: ").strip()

    result = extract_students(filiere)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✅ Extracted {len(result)} students")
    print(f"📌 Filiere set to: {filiere}")
    print(f"✔ Saved to {OUTPUT_JSON}")
