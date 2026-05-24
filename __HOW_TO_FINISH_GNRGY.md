# החזרה לגרסה הקודמת (לפני ג'ינרג'י)

זה מה שצריך לעשות עכשיו: לבטל את התוספת של ג'ינרג'י באתר ולחזור למצב שהיה לפני (רק EV-Edge + GreenSpot בפילטר).

הקבצים המקומיים אצלי כבר שוחזרו. נשארה רק פעולה אחת — push לשרת.

---

## מה לעשות (פקודה אחת ב-PowerShell)

פתח PowerShell והרץ את הפקודות האלה אחת אחת:

```
cd C:\Users\zmayer\Desktop\claude\carcharge\evcharge-site
```

```
git add app/page.tsx
```

```
git commit -m "Revert: remove Gnrgy provider button"
```

```
git push origin main
```

---

## ודא שזה עבד

המתן 30-60 שניות (Vercel עושה build חדש), אז:

1. פתח את `https://evcharge-eight.vercel.app`
2. לחץ Ctrl+F5 (רענון מלא בלי cache)

אמור לראות שוב **3 כפתורי ספקים בלבד**:
- כל החברות
- EV-Edge
- GreenSpot

כפתור ג'ינרג'י נעלם.

---

## הערה — קבצים יתומים

הקבצים `lib/gnrgy.ts`, `app/api/gnrgy/`, `lib/zen.ts`, `app/api/zen/` עדיין קיימים בתיקיה ובגיט, אבל **לא מיובאים לשום מקום** — אין להם השפעה על האתר. אפשר להשאיר אותם או למחוק:

```
Remove-Item -Recurse lib\gnrgy.ts, app\api\gnrgy, lib\zen.ts, app\api\zen
git add -A
git commit -m "Clean up unused placeholder files"
git push origin main
```

---

## אם בכל זאת תרצה לנסות שוב

יש tag-ים שמורים שאפשר לחזור אליהם:
- `safe-before-agent-update-20260520-081028` — לפני כל הניסיון
- `safe-before-gnrgy-attempt-20260520-082958` — לפני ניסיון ג'ינרג'י
- קומיט `f9a5ec1` — המצב עם כפתור ג'ינרג'י

```
git reset --hard f9a5ec1
git push origin main --force
```

---

## הקובץ הזה

אחרי שגמרת — אפשר למחוק:
```
Remove-Item __HOW_TO_FINISH_GNRGY.md
```
