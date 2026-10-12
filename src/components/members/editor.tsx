import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { buttonClass, quietButtonClass } from "@/components/members/account";
import { Shell, fieldClass } from "@/components/shell";
import { accountLink, readLink } from "@/lib/lang-path";
import { membersOn } from "@/lib/members/config";
import { extendPaid } from "@/lib/members/rules";
import { isEditor, supabase, useMember } from "@/lib/members/session";
import { CARDS } from "@/lib/seed";
import { LANGS, type Lang } from "@/lib/types";

/**
 * The editor's members panel, in Turkish: comments, members, members-only texts and
 * blocked words. Only a profile with the editor role gets past the door, and the
 * database checks that role again on every change.
 */
export function EditorPage() {
  return (
    <Shell>
      <main className="px-5 py-10 md:px-12 md:py-14">
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          <h1 className="text-3xl md:text-4xl">Editör paneli</h1>
          <Door />
        </div>
      </main>
    </Shell>
  );
}

function Door() {
  const member = useMember();
  if (!membersOn || member.status === "off") {
    return <p className="text-muted">Üyelik kapalı. Açmak için docs/uyelik-etkinlestirme.md dosyasına bakın.</p>;
  }
  if (member.status === "loading") return <p className="text-muted">Yükleniyor…</p>;
  if (member.status === "out") {
    return (
      <Link {...accountLink("tr", "/editor")} className="inline-flex min-h-11 items-center text-pine">
        Giriş yap
      </Link>
    );
  }
  if (!isEditor(member)) return <p className="text-muted">Bu sayfa yalnız editöre açık.</p>;
  return (
    <>
      <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {[
          ["yorumlar", "Yorumlar"],
          ["uyeler", "Üyeler"],
          ["metinler", "Üyelere özel metinler"],
          ["kelimeler", "Yasaklı kelimeler"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-9 items-center text-pine">
            {label}
          </a>
        ))}
      </nav>
      <CommentsBox />
      <MembersBox />
      <TextsBox />
      <WordsBox />
    </>
  );
}

function Box({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Note({ text }: { text: string }) {
  return text ? (
    <p role="status" className="text-sm text-pine">
      {text}
    </p>
  ) : null;
}

const fail = (error: unknown) =>
  `Olmadı: ${String((error as { message?: unknown } | null)?.message ?? error)}`;

const storyTitle = (id: string) => {
  const card = CARDS.find((c) => c.id === id);
  return card ? card.locales.tr.title || card.locales.en.title || id : id;
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";

// ---------------------------------------------------------------------------------------

type AdminComment = {
  id: string;
  story_id: string;
  lang: Lang;
  author_name: string;
  body: string;
  hidden: boolean;
  report_count: number;
  created_at: string;
};

function CommentsBox() {
  const [onlyHidden, setOnlyHidden] = useState(true);
  const [list, setList] = useState<AdminComment[] | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setList(null);
    try {
      const client = await supabase();
      let query = client
        .from("comments")
        .select("id, story_id, lang, author_name, body, hidden, report_count, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (onlyHidden) query = query.eq("hidden", true);
      const { data, error } = await query;
      if (error) throw error;
      setList((data as AdminComment[]) ?? []);
    } catch (error) {
      setNote(fail(error));
      setList([]);
    }
  }, [onlyHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "restore" | "hide" | "delete") {
    setNote("");
    try {
      const client = await supabase();
      if (action === "delete") {
        if (!window.confirm("Yorum kalıcı olarak silinsin mi?")) return;
        const { error } = await client.from("comments").delete().eq("id", id);
        if (error) throw error;
      } else if (action === "restore") {
        // Clear the reports too, or the next single report would hide it again.
        const cleared = await client.from("comment_reports").delete().eq("comment_id", id);
        if (cleared.error) throw cleared.error;
        const { error } = await client
          .from("comments")
          .update({ hidden: false, report_count: 0 })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await client.from("comments").update({ hidden: true }).eq("id", id);
        if (error) throw error;
      }
      await load();
    } catch (error) {
      setNote(fail(error));
    }
  }

  return (
    <Box id="yorumlar" title="Yorumlar">
      <div className="flex gap-5 text-sm">
        <button
          type="button"
          onClick={() => setOnlyHidden(true)}
          className={onlyHidden ? "underline underline-offset-4" : "text-muted"}
        >
          Gizlenenler
        </button>
        <button
          type="button"
          onClick={() => setOnlyHidden(false)}
          className={!onlyHidden ? "underline underline-offset-4" : "text-muted"}
        >
          Son yorumlar
        </button>
      </div>
      <p className="text-sm text-muted">
        Üç ayrı üyenin bildirdiği yorum kendiliğinden gizlenir ve burada görünür. Geri açtığınızda
        bildirimleri de sıfırlanır.
      </p>
      <Note text={note} />
      {list === null ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">{onlyHidden ? "Gizlenen yorum yok." : "Henüz yorum yok."}</p>
      ) : (
        <ol className="flex flex-col">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 border-b border-line py-4">
              <p className="text-xs text-muted">
                <Link {...readLink(c.lang, c.story_id)} className="text-pine">
                  {storyTitle(c.story_id)}
                </Link>
                {` · ${c.lang.toUpperCase()} · ${c.author_name} · ${day(c.created_at)}`}
                {c.report_count ? ` · ${c.report_count} bildirim` : ""}
                {c.hidden ? " · gizli" : ""}
              </p>
              <p className="whitespace-pre-line break-words">{c.body}</p>
              <div className="flex gap-5 text-sm">
                {c.hidden ? (
                  <button type="button" className={quietButtonClass} onClick={() => void act(c.id, "restore")}>
                    Geri aç
                  </button>
                ) : (
                  <button type="button" className={quietButtonClass} onClick={() => void act(c.id, "hide")}>
                    Gizle
                  </button>
                )}
                <button type="button" className={quietButtonClass} onClick={() => void act(c.id, "delete")}>
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------------------

type AdminProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  paid_until: string | null;
  created_at: string;
};

function MembersBox() {
  const [search, setSearch] = useState("");
  const [list, setList] = useState<AdminProfile[] | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (term: string) => {
    setList(null);
    try {
      const client = await supabase();
      let query = client
        .from("profiles")
        .select("id, email, display_name, role, paid_until, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const clean = term.trim().replace(/[%_,()]/g, "");
      if (clean) query = query.or(`email.ilike.%${clean}%,display_name.ilike.%${clean}%`);
      const { data, error } = await query;
      if (error) throw error;
      setList((data as AdminProfile[]) ?? []);
    } catch (error) {
      setNote(fail(error));
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function setPaid(profile: AdminProfile, months: number | null) {
    setNote("");
    try {
      const client = await supabase();
      const paid_until = months === null ? null : extendPaid(profile.paid_until, months);
      const { error } = await client.from("profiles").update({ paid_until }).eq("id", profile.id);
      if (error) throw error;
      await load(search);
    } catch (error) {
      setNote(fail(error));
    }
  }

  return (
    <Box id="uyeler" title="Üyeler">
      <p className="text-sm text-muted">
        Ödeme sistemi bağlanana kadar ücretli üyeliği buradan siz verirsiniz. Süre, kalan sürenin
        üstüne eklenir.
      </p>
      <form
        className="flex gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void load(search);
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="E-posta ya da ad"
          className={fieldClass()}
        />
        <button type="submit" className={buttonClass}>
          Ara
        </button>
      </form>
      <Note text={note} />
      {list === null ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">Üye bulunamadı.</p>
      ) : (
        <ol className="flex flex-col">
          {list.map((p) => {
            const paid = p.paid_until && new Date(p.paid_until) > new Date();
            return (
              <li key={p.id} className="flex flex-col gap-1 border-b border-line py-4">
                <p dir="ltr" className="text-start break-all">
                  {p.email}
                </p>
                <p className="text-sm text-muted">
                  {[
                    p.display_name,
                    p.role === "editor" ? "Editör" : paid ? `Ücretli, ${day(p.paid_until)} tarihine kadar` : "Ücretsiz",
                    `Kayıt: ${day(p.created_at)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.role !== "editor" ? (
                  <div className="flex flex-wrap gap-x-5 text-sm">
                    <button type="button" className={quietButtonClass} onClick={() => void setPaid(p, 1)}>
                      +1 ay
                    </button>
                    <button type="button" className={quietButtonClass} onClick={() => void setPaid(p, 12)}>
                      +1 yıl
                    </button>
                    {paid ? (
                      <button type="button" className={quietButtonClass} onClick={() => void setPaid(p, null)}>
                        Ücretliliği kaldır
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------------------

const LANG_NAMES: Record<Lang, string> = {
  tr: "Türkçe",
  ar: "Arapça",
  en: "İngilizce",
  fr: "Fransızca",
  es: "İspanyolca",
};

function StoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm">Yazı</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()}>
        <option value="">Seçin</option>
        {CARDS.map((card) => (
          <option key={card.id} value={card.id}>
            {card.membersOnly ? "● " : ""}
            {storyTitle(card.id)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextsBox() {
  const [storyId, setStoryId] = useState("");
  const [lang, setLang] = useState<Lang>("tr");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");
  const card = CARDS.find((c) => c.id === storyId);

  useEffect(() => {
    if (!storyId) return;
    let live = true;
    setLoaded(false);
    setNote("");
    void supabase()
      .then((client) =>
        client.from("member_texts").select("body").eq("story_id", storyId).eq("lang", lang).maybeSingle(),
      )
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setNote(fail(error));
        setBody((data as { body?: string } | null)?.body ?? "");
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [storyId, lang]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setNote("");
    try {
      const client = await supabase();
      const { error } = await client
        .from("member_texts")
        .upsert({ story_id: storyId, lang, body, updated_at: new Date().toISOString() });
      if (error) throw error;
      setNote("Kaydedildi.");
    } catch (error) {
      setNote(fail(error));
    }
  }

  return (
    <Box id="metinler" title="Üyelere özel metinler">
      <div className="flex flex-col gap-2 text-sm text-muted">
        <p>
          Üyelere özel bir yazıda sitenin herkese açık dosyasında yalnız giriş bölümü durur ve dosyada
          &quot;membersOnly&quot;: true yazar. Yazının tamamı buraya, her dil için ayrı girilir; ücretli
          üye yazıyı açınca giriş bölümünün yerine bu metin görünür.
        </p>
        <p>● işaretli yazılar dosyasında üyelere özel olarak işaretlenmiş olanlar.</p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <StoryPicker value={storyId} onChange={setStoryId} />
        <label className="flex flex-col gap-2">
          <span className="text-sm">Dil</span>
          <select
            value={lang}
            onChange={(event) => setLang(event.target.value as Lang)}
            className={fieldClass()}
          >
            {LANGS.map((code) => (
              <option key={code} value={code}>
                {LANG_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
        {storyId && card && !card.membersOnly ? (
          <p className="text-sm text-pine">
            Bu yazı dosyasında üyelere özel işaretli değil; buraya yazılan metin sitede görünmez.
          </p>
        ) : null}
        {storyId ? (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-sm">Yazının tamamı (paragraflar arasında bir boş satır)</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={18}
                dir={lang === "ar" ? "rtl" : "ltr"}
                disabled={!loaded}
                className={`${fieldClass()} resize-y`}
              />
            </label>
            <button type="submit" disabled={!loaded} className={`${buttonClass} self-start`}>
              Kaydet
            </button>
          </>
        ) : null}
        <Note text={note} />
      </form>
    </Box>
  );
}

// ---------------------------------------------------------------------------------------

function WordsBox() {
  const [words, setWords] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const client = await supabase();
    const { data } = await client.from("blocked_words").select("word").order("word");
    setWords(((data as { word: string }[]) ?? []).map((row) => row.word));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = word.trim().toLocaleLowerCase("tr");
    if (value.length < 2) return;
    setNote("");
    try {
      const client = await supabase();
      const { error } = await client.from("blocked_words").upsert({ word: value });
      if (error) throw error;
      setWord("");
      await load();
    } catch (error) {
      setNote(fail(error));
    }
  }

  async function remove(value: string) {
    try {
      const client = await supabase();
      const { error } = await client.from("blocked_words").delete().eq("word", value);
      if (error) throw error;
      await load();
    } catch (error) {
      setNote(fail(error));
    }
  }

  return (
    <Box id="kelimeler" title="Yasaklı kelimeler">
      <p className="text-sm text-muted">
        Bu kelimelerden biri tam kelime olarak geçen yorum kaydedilmez; okuyucuya izin verilmeyen bir
        kelime olduğu söylenir. Kelimenin ekli hâllerini ayrıca eklemek gerekir.
      </p>
      <form onSubmit={add} className="flex gap-3">
        <input value={word} onChange={(event) => setWord(event.target.value)} className={fieldClass()} />
        <button type="submit" className={buttonClass}>
          Ekle
        </button>
      </form>
      <Note text={note} />
      <ul className="flex flex-wrap gap-2">
        {words.map((value) => (
          <li key={value}>
            <button
              type="button"
              title="Kaldır"
              onClick={() => void remove(value)}
              className="inline-flex min-h-9 items-center border border-line px-3 text-sm hover:border-ink"
            >
              {value} ×
            </button>
          </li>
        ))}
      </ul>
    </Box>
  );
}
