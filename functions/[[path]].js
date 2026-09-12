export async function onRequest(context) { 
    const { request, env } = context;

    function lowercaseKeys(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => lowercaseKeys(item));
        }
        const res = {};
        for (const k in obj) {
            const val = obj[k];
            res[k.toLowerCase()] = (typeof val === 'object' && val !== null) ? lowercaseKeys(val) : val;
        }
        return res;
    }

    const url = new URL(request.url);
    const decodedPath = decodeURIComponent(url.pathname).toLowerCase();

    // 🚀 REDIRECT HEAVY STATIC APP FILES TO BYPASS CLOUDFLARE PAGES' 25MB SIZE LIMIT!
    if (decodedPath.endsWith("/ahmed abd-elfatah app setup 1.0.0.exe")) {
        if (env.WINDOWS_APP_URL) {
            return Response.redirect(env.WINDOWS_APP_URL, 302);
        }
        return Response.redirect("https://github.com/Ahmed-AbdElfatah-Apps/Ahmed-AbdElfatah-Apps/releases/download/Apps/Ahmed.Abd-Elfatah.App.Setup.1.0.0.exe", 302);
    }

    if (decodedPath.endsWith("/ahmed abd-elfatah app 1.0.0.dmg") || decodedPath.endsWith("/ahmed_abd-elfatah_app-1.0.0-arm64.1.dmg")) {
        if (env.MACOS_APP_URL) {
            return Response.redirect(env.MACOS_APP_URL, 302);
        }
        return Response.redirect("https://github.com/Ahmed-AbdElfatah-Apps/Ahmed-AbdElfatah-Apps/releases/download/Apps(MacOS)/Ahmed_Abd-Elfatah_App-1.0.0-arm64.1.dmg", 302);
    }

    if (decodedPath.endsWith("/ahmed abd-elfatah app 1.0.0.apk")) {
        if (env.ANDROID_APP_URL) {
            return Response.redirect(env.ANDROID_APP_URL, 302);
        }
        return Response.redirect("https://github.com/Ahmed-AbdElfatah-Apps/Ahmed-AbdElfatah-Apps/releases/download/Apps/Ahmed.Abd-Elfatah.App.1.0.0.apk", 302);
    }

    // 🔒 VIDEO SHIELD: Intercept and securely stream from Archive.org strictly (The Free Storage Hack)!
    if (url.pathname.startsWith("/videos/")) {
        const userAgent = request.headers.get("User-Agent") || "";
        const secureSignatures = [
            "AhmedAcademySecureApp_SecureVideoSessionEngine",
            "AhmedAcademyMobileAppSecureChannel"
        ];

        // Access Control Gatekeeper
        if (!secureSignatures.some(sig => userAgent.includes(sig))) {
            return new Response("Access Denied: This premium video content can only be streamed inside the official Android application.", {
                status: 403,
                headers: { 
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const filename = url.pathname.substring(8); // Extract filename (removes "/videos/")
        if (!filename) {
            return new Response("Filename missing.", { status: 400 });
        }

        const decodedFilename = decodeURIComponent(filename);
        const archiveItem = env.ARCHIVE_ITEM || "ahmed-academy";

        let videoUrl = "";
        if (decodedFilename.startsWith("http://") || decodedFilename.startsWith("https://")) {
            videoUrl = decodedFilename;
        } else if (decodedFilename.includes("archive.org")) {
            const match = decodedFilename.match(/(?:https?|https|http)?[:/]+archive\.org\/download\/(.+)/);
            if (match) {
                videoUrl = `https://archive.org/download/${match[1]}`;
            } else {
                videoUrl = `https://archive.org/download/${decodedFilename.replace(/^[./]+/, '')}`;
            }
        } else if (decodedFilename.includes("/")) {
            videoUrl = `https://archive.org/download/${decodedFilename}`;
        } else {
            videoUrl = `https://archive.org/download/${archiveItem}/${decodedFilename}`;
        }

        const rangeHeader = request.headers.get("Range");
        const fetchHeaders = new Headers();
        if (rangeHeader) {
            fetchHeaders.set("Range", rangeHeader);
        }
        fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        try {
            const archiveRes = await fetch(videoUrl, {
                headers: fetchHeaders
            });

            if (archiveRes.status === 404) {
                return new Response(`Video lecture file not found on Archive.org: ${videoUrl}`, {
                    status: 404,
                    headers: { "Access-Control-Allow-Origin": "*" }
                });
            }

            const responseHeaders = new Headers(archiveRes.headers);
            responseHeaders.set("Access-Control-Allow-Origin", "*");
            responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
            responseHeaders.set("Accept-Ranges", "bytes");
            responseHeaders.set("Content-Type", "video/mp4");

            return new Response(archiveRes.body, {
                status: archiveRes.status,
                statusText: archiveRes.statusText,
                headers: responseHeaders
            });
        } catch (fetchError) {
            return new Response(`Proxy streaming error: ${fetchError.message}`, {
                status: 500,
                headers: { "Access-Control-Allow-Origin": "*" }
            });
        }
    }

    // Serve static files if not an API request
    if (!url.pathname.startsWith("/api/")) {
        return await context.next();
    }

    const path = url.pathname.replace(/^\/api\//, "");
    const method = request.method;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (!env.DB) {
        return new Response(JSON.stringify({ error: "Cloudflare D1 Database binding 'DB' not configured." }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }

    try {
        // Safe database auto-migrations
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN watched_lessons TEXT DEFAULT '[]'").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN lecture_notes TEXT DEFAULT '[]'").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE videos_table ADD COLUMN duration INTEGER DEFAULT 45").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN can_post_feed INTEGER DEFAULT 0").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN custom_style TEXT DEFAULT ''").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE feed_table ADD COLUMN font_size TEXT DEFAULT '13px'").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE feed_table ADD COLUMN text_color TEXT DEFAULT ''").run();
        } catch (e) {}
        try {
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS feedbacks_table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author TEXT,
                    gender TEXT,
                    id_val TEXT,
                    rating INTEGER DEFAULT 0,
                    text TEXT,
                    date TEXT
                )
            `).run();
        } catch (e) {}

        // Routing endpoints
        if (path === "login" && method === "POST") {
            const body = await request.json();
            const { idVal, passVal, role } = body;

            const user = lowercaseKeys(await env.DB.prepare(
                "SELECT * FROM students_table WHERE role = ? AND phone = ? AND password = ?"
            ).bind(role, idVal, passVal).first());

            if (!user) {
                return new Response(JSON.stringify({ error: "Access Denied: Invalid credentials." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
            return new Response(JSON.stringify(user), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path === "login-bypass" && method === "POST") {
            let admin = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE role = 'admin' LIMIT 1").first());
            if (!admin) {
                const existingAdminUser = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE phone = 'admin'").first());
                if (existingAdminUser) {
                    const existingId = existingAdminUser.id !== undefined ? existingAdminUser.id : existingAdminUser.ID;
                    await env.DB.prepare("UPDATE students_table SET role = 'admin', grade = 'all' WHERE id = ?").bind(parseInt(existingId)).run();
                    admin = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE id = ?").bind(parseInt(existingId)).first());
                } else {
                    await env.DB.prepare(
                        "INSERT INTO students_table (name, phone, password, grade, role, gender, can_post_feed, custom_style, grades_record) VALUES (?, ?, ?, ?, ?, ?, 1, ?, '[]')"
                    ).bind("Administrator", "admin", "admin", "all", "admin", "Boy", "").run();
                    
                    admin = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE role = 'admin' LIMIT 1").first());
                }
            }
            return new Response(JSON.stringify(admin), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path.startsWith("students")) {
            const studentId = url.searchParams.get("id");
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM students_table").all();
                return new Response(JSON.stringify(lowercaseKeys(results)), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const s = await request.json();
                const name = s.name !== undefined && s.name !== null ? s.name : "";
                const phone = s.phone !== undefined && s.phone !== null ? s.phone : "";
                const password = s.password !== undefined && s.password !== null ? s.password : "";
                const grade = s.grade !== undefined && s.grade !== null ? s.grade : "Grade 10 (Secandory 1)";
                const gender = s.gender !== undefined && s.gender !== null ? s.gender : "Boy";
                const can_post_feed = s.can_post_feed !== undefined && s.can_post_feed !== null ? parseInt(s.can_post_feed) : 0;
                const custom_style = s.custom_style !== undefined && s.custom_style !== null ? s.custom_style : "";

                const result = await env.DB.prepare(
                    "INSERT INTO students_table (name, phone, password, grade, role, gender, can_post_feed, custom_style, grades_record) VALUES (?, ?, ?, ?, 'student', ?, ?, ?, '[]')"
                ).bind(name, phone, password, grade, gender, can_post_feed, custom_style).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "PUT") {
                const s = await request.json();
                const name = s.name !== undefined && s.name !== null ? s.name : "";
                const phone = s.phone !== undefined && s.phone !== null ? s.phone : "";
                const password = s.password !== undefined && s.password !== null ? s.password : "";
                const grade = s.grade !== undefined && s.grade !== null ? s.grade : "Grade 10 (Secandory 1)";
                const gender = s.gender !== undefined && s.gender !== null ? s.gender : "Boy";
                const can_post_feed = s.can_post_feed !== undefined && s.can_post_feed !== null ? parseInt(s.can_post_feed) : 0;
                const custom_style = s.custom_style !== undefined && s.custom_style !== null ? s.custom_style : "";
                const numericId = studentId && !isNaN(parseInt(studentId)) ? parseInt(studentId) : 0;

                await env.DB.prepare(
                    "UPDATE students_table SET name = ?, phone = ?, password = ?, grade = ?, gender = ?, can_post_feed = ?, custom_style = ? WHERE id = ?"
                ).bind(name, phone, password, grade, gender, can_post_feed, custom_style, numericId).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "DELETE") {
                const numericId = studentId && !isNaN(parseInt(studentId)) ? parseInt(studentId) : 0;
                await env.DB.prepare("DELETE FROM students_table WHERE id = ?").bind(numericId).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (path === "students-privilege" && method === "POST") {
            const body = await request.json();
            let studentId = undefined;
            for (const k in body) {
                if (k.toLowerCase() === "id") {
                    studentId = body[k];
                    break;
                }
            }

            if (studentId === undefined || studentId === null || isNaN(parseInt(studentId))) {
                return new Response(JSON.stringify({ error: "Missing or invalid student ID parameter." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const user = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
            if (user) {
                let currentRole = "student";
                let currentGrade = "Grade 10 (Secandory 1)";
                for (const k in user) {
                    if (k.toLowerCase() === "role") currentRole = user[k] || "student";
                    if (k.toLowerCase() === "grade") currentGrade = user[k] || "Grade 10 (Secandory 1)";
                }

                const nextRole = currentRole === "admin" ? "student" : "admin";
                const nextGrade = nextRole === "admin" ? "all" : "Grade 10 (Secandory 1)";

                await env.DB.prepare("UPDATE students_table SET role = ?, grade = ? WHERE id = ?")
                    .bind(nextRole, nextGrade, parseInt(studentId))
                    .run();

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            } else {
                return new Response(JSON.stringify({ error: `Student with ID ${studentId} not found in database.` }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        // Toggles feed posting permission from backend
        if (path === "students-feed-privilege" && method === "POST") {
            const body = await request.json();
            let studentId = undefined;
            for (const k in body) {
                if (k.toLowerCase() === "id") {
                    studentId = body[k];
                    break;
                }
            }

            if (studentId === undefined || studentId === null || isNaN(parseInt(studentId))) {
                return new Response(JSON.stringify({ error: "Missing or invalid student ID parameter." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const user = lowercaseKeys(await env.DB.prepare("SELECT * FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
            if (user) {
                let currentFeedPriv = 0;
                for (const k in user) {
                    if (k.toLowerCase() === "can_post_feed") currentFeedPriv = parseInt(user[k]) || 0;
                }

                const nextFeedPriv = currentFeedPriv === 1 ? 0 : 1;

                await env.DB.prepare("UPDATE students_table SET can_post_feed = ? WHERE id = ?")
                    .bind(nextFeedPriv, parseInt(studentId))
                    .run();

                return new Response(JSON.stringify({ success: true, can_post_feed: nextFeedPriv }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            } else {
                return new Response(JSON.stringify({ error: `Student with ID ${studentId} not found in database.` }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        if (path === "video-progress" && method === "POST") {
            const body = await request.json();
            const { studentId, videoId, seconds, duration, completed } = body;
            
            const student = lowercaseKeys(await env.DB.prepare("SELECT watched_lessons FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
            if (student) {
                let watched = [];
                try {
                    watched = typeof student.watched_lessons === 'string' ? JSON.parse(student.watched_lessons || "[]") : (student.watched_lessons || []);
                } catch(e) { watched = []; }

                const idx = watched.findIndex(w => w.videoId === parseInt(videoId));
                if (idx !== -1) {
                    watched[idx].seconds = Math.max(watched[idx].seconds || 0, parseFloat(seconds));
                    watched[idx].duration = parseFloat(duration);
                    if (completed) watched[idx].completed = true;
                } else {
                    watched.push({
                        videoId: parseInt(videoId),
                        seconds: parseFloat(seconds),
                        duration: parseFloat(duration),
                        completed: !!completed
                    });
                }

                await env.DB.prepare("UPDATE students_table SET watched_lessons = ? WHERE id = ?").bind(
                    JSON.stringify(watched), parseInt(studentId)
                ).run();

                return new Response(JSON.stringify({ success: true, watched_lessons: watched }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } else {
                return new Response(JSON.stringify({ error: "Student not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        if (path.startsWith("videos")) {
            const videoId = url.searchParams.get("id");
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM videos_table ORDER BY lesson ASC").all();
                return new Response(JSON.stringify(lowercaseKeys(results)), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const v = await request.json();
                const result = await env.DB.prepare(
                    "INSERT INTO videos_table (filename, title, lesson, grade, duration) VALUES (?, ?, ?, ?, ?)"
                ).bind(v.filename, v.title, v.lesson, v.grade, parseInt(v.duration) || 45).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "DELETE") {
                await env.DB.prepare("DELETE FROM videos_table WHERE id = ?").bind(parseInt(videoId)).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (path.startsWith("materials")) {
            const matId = url.searchParams.get("id");
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM materials_table ORDER BY id DESC").all();
                return new Response(JSON.stringify(lowercaseKeys(results)), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const m = await request.json();
                const result = await env.DB.prepare(
                    "INSERT INTO materials_table (title, grade, type, desc, filename) VALUES (?, ?, ?, ?, ?)"
                ).bind(m.title, m.grade, m.type, m.desc, m.filename).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "DELETE") {
                await env.DB.prepare("DELETE FROM materials_table WHERE id = ?").bind(parseInt(matId)).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (path.startsWith("feed/") && path.includes("/comment/") && path.endsWith("/like") && method === "POST") {
            const parts = path.split("/");
            const postId = parseInt(parts[1]);
            const commentId = parseFloat(parts[3]);
            const body = await request.json();

            const post = lowercaseKeys(await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(postId).first());
            if (!post) {
                return new Response(JSON.stringify({ error: "Post not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            let comments = [];
            try {
                comments = JSON.parse(post.comments_json || "[]");
            } catch(e) { comments = []; }

            const cIdx = comments.findIndex(c => c.id === commentId);
            if (cIdx === -1) {
                return new Response(JSON.stringify({ error: "Comment not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            if (!comments[cIdx].likes) comments[cIdx].likes = [];
            const nameIdx = comments[cIdx].likes.indexOf(body.name);
            if (nameIdx !== -1) {
                comments[cIdx].likes.splice(nameIdx, 1);
            } else {
                comments[cIdx].likes.push(body.name);
            }

            await env.DB.prepare("UPDATE feed_table SET comments_json = ? WHERE id = ?").bind(
                JSON.stringify(comments), postId
            ).run();
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path.startsWith("feed/") && !path.includes("/comment/") && path.endsWith("/like") && method === "POST") {
            const postId = parseInt(path.split("/")[1]);
            const body = await request.json();
            const post = lowercaseKeys(await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(postId).first());
            if (!post) {
                return new Response(JSON.stringify({ error: "Post not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            let likes = [];
            try {
                likes = JSON.parse(post.likes_json || "[]");
            } catch(e) { likes = []; }

            const nameIdx = likes.indexOf(body.name);
            if (nameIdx !== -1) {
                likes.splice(nameIdx, 1);
            } else {
                likes.push(body.name);
            }

            await env.DB.prepare("UPDATE feed_table SET likes_json = ? WHERE id = ?").bind(
                JSON.stringify(likes), postId
            ).run();
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path === "lecture-notes") {
            if (method === "GET") {
                const studentId = url.searchParams.get("studentId");
                const videoId = url.searchParams.get("videoId");
                const student = lowercaseKeys(await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
                if (student) {
                    let notes = [];
                    try {
                        notes = typeof student.lecture_notes === 'string' ? JSON.parse(student.lecture_notes || "[]") : (student.lecture_notes || []);
                    } catch(e) { notes = []; }
                    const videoNotes = notes.filter(n => n.videoId === parseInt(videoId));
                    return new Response(JSON.stringify(videoNotes), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const body = await request.json();
                const { studentId, videoId, noteText, timestamp } = body;
                const student = lowercaseKeys(await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
                if (student) {
                    let notes = [];
                    try {
                        notes = typeof student.lecture_notes === 'string' ? JSON.parse(student.lecture_notes || "[]") : (student.lecture_notes || []);
                    } catch(e) { notes = []; }
                    notes.push({
                        id: Date.now(),
                        videoId: parseInt(videoId),
                        noteText,
                        timestamp: parseFloat(timestamp)
                    });
                    await env.DB.prepare("UPDATE students_table SET lecture_notes = ? WHERE id = ?").bind(
                        JSON.stringify(notes), parseInt(studentId)
                    ).run();
                    const videoNotes = notes.filter(n => n.videoId === parseInt(videoId));
                    return new Response(JSON.stringify(videoNotes), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                return new Response(JSON.stringify({ error: "Student not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
            if (method === "DELETE") {
                const studentId = url.searchParams.get("studentId");
                const noteId = url.searchParams.get("noteId");
                const videoId = url.searchParams.get("videoId");
                const student = lowercaseKeys(await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first());
                if (student) {
                    let notes = [];
                    try {
                        notes = typeof student.lecture_notes === 'string' ? JSON.parse(student.lecture_notes || "[]") : (student.lecture_notes || []);
                    } catch(e) { notes = []; }
                    notes = notes.filter(n => n.id !== parseInt(noteId));
                    await env.DB.prepare("UPDATE students_table SET lecture_notes = ? WHERE id = ?").bind(
                        JSON.stringify(notes), parseInt(studentId)
                    ).run();
                    const videoNotes = notes.filter(n => n.videoId === parseInt(videoId));
                    return new Response(JSON.stringify(videoNotes), {
                        headers: { "Content-Type": "application/json", ...corsHeaders }
                    });
                }
                return new Response(JSON.stringify({ error: "Student not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }

        if (path === "leaderboard" && method === "GET") {
            const { results } = await env.DB.prepare("SELECT id, name, grade, gender, role, watched_lessons FROM students_table WHERE role = 'student'").all();
            const normalizedResults = lowercaseKeys(results);
            const leaderboard = normalizedResults.map(s => {
                let watched = [];
                try {
                    watched = typeof s.watched_lessons === 'string' ? JSON.parse(s.watched_lessons || "[]") : (s.watched_lessons || []);
                } catch(e) { watched = []; }
                
                let totalSeconds = 0;
                watched.forEach(w => {
                    totalSeconds += parseFloat(w.seconds || 0);
                });
                return {
                    id: s.id,
                    name: s.name,
                    grade: s.grade,
                    gender: s.gender,
                    totalMinutes: Math.round(totalSeconds / 60)
                };
            });
            leaderboard.sort((a, b) => b.totalMinutes - a.totalMinutes);
            return new Response(JSON.stringify(leaderboard.slice(0, 10)), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        if (path === "feed") {
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM feed_table ORDER BY id DESC").all();
                const normalizedResults = lowercaseKeys(results);
                for (let post of normalizedResults) {
                    try {
                        post.comments = JSON.parse(post.comments_json || "[]");
                    } catch(e) { post.comments = []; }
                }
                return new Response(JSON.stringify(normalizedResults), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const f = await request.json();
                const fontSize = f.fontSize !== undefined && f.fontSize !== null ? f.fontSize : "13px";
                const textColor = f.textColor !== undefined && f.textColor !== null ? f.textColor : "";
                const result = await env.DB.prepare(
                    "INSERT INTO feed_table (author, date, text, attachment_name, image, font_size, text_color, comments_json) VALUES (?, ?, ?, ?, ?, ?, ?, '[]')"
                ).bind(f.author, f.date, f.text, f.attachment_name, f.image, fontSize, textColor).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "DELETE") {
                const feedId = url.searchParams.get("id");
                await env.DB.prepare("DELETE FROM feed_table WHERE id = ?").bind(parseInt(feedId)).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (path === "comments" && method === "POST") {
            const body = await request.json();
            const post = lowercaseKeys(await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(body.postId).first());
            if (post) {
                let comments = [];
                try {
                    comments = JSON.parse(post.comments_json || "[]");
                } catch(e) { comments = []; }

                if (body.commentId) {
                    const cIdx = comments.findIndex(c => c.id === parseFloat(body.commentId));
                    if (cIdx !== -1) {
                        if (!comments[cIdx].replies) comments[cIdx].replies = [];
                        comments[cIdx].replies.push({
                            id: Date.now() + Math.random(),
                            author: body.author,
                            authorGrade: body.authorGrade,
                            authorRole: body.authorRole,
                            text: body.text,
                            date: 'Just now'
                        });
                    }
                } else {
                    comments.push({
                        id: Date.now() + Math.random(),
                        author: body.author,
                        authorGrade: body.authorGrade,
                        authorRole: body.authorRole,
                        text: body.text,
                        likes: [],
                        replies: [],
                        date: 'Just now'
                    });
                }
                
                await env.DB.prepare("UPDATE feed_table SET comments_json = ? WHERE id = ?").bind(
                    JSON.stringify(comments), body.postId
                ).run();

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        // New high-fidelity API endpoints for feedbacks
        if (path.startsWith("feedbacks")) {
            const feedbackId = url.searchParams.get("id");
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM feedbacks_table ORDER BY id DESC").all();
                return new Response(JSON.stringify(lowercaseKeys(results)), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const f = await request.json();
                const author = f.author !== undefined && f.author !== null ? f.author : "";
                const gender = f.gender !== undefined && f.gender !== null ? f.gender : "Boy";
                const idVal = f.idVal !== undefined && f.idVal !== null ? f.idVal : "";
                const rating = f.rating !== undefined && f.rating !== null ? parseInt(f.rating) : 0;
                const text = f.text !== undefined && f.text !== null ? f.text : "";
                const date = f.date !== undefined && f.date !== null ? f.date : "";

                const result = await env.DB.prepare(
                    "INSERT INTO feedbacks_table (author, gender, id_val, rating, text, date) VALUES (?, ?, ?, ?, ?, ?)"
                ).bind(author, gender, idVal, rating, text, date).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "DELETE") {
                await env.DB.prepare("DELETE FROM feedbacks_table WHERE id = ?").bind(parseInt(feedbackId)).run();
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        if (path === "export" && method === "GET") {
            const students = lowercaseKeys((await env.DB.prepare("SELECT * FROM students_table").all()).results);
            const videos = lowercaseKeys((await env.DB.prepare("SELECT * FROM videos_table").all()).results);
            const feed = lowercaseKeys((await env.DB.prepare("SELECT * FROM feed_table").all()).results);
            const materials = lowercaseKeys((await env.DB.prepare("SELECT * FROM materials_table").all()).results);
            let feedbacks = [];
            try {
                feedbacks = lowercaseKeys((await env.DB.prepare("SELECT * FROM feedbacks_table").all()).results);
            } catch(e) {}
            return new Response(JSON.stringify({ students, videos, feed, materials, feedbacks }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        if (path === "sql" && method === "POST") {
            const body = await request.json();
            const results = (await env.DB.prepare(body.query).all()).results;
            return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        return new Response(JSON.stringify({ error: `Not found: /api/${path}` }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
}
