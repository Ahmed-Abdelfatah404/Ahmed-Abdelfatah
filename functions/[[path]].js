export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 🚀 BYPASS ENGINE: If the request is NOT for the API, serve the static frontend index.html!
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

    try {
        // Auto-run database migrations
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN watched_lessons TEXT DEFAULT '[]'").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE students_table ADD COLUMN lecture_notes TEXT DEFAULT '[]'").run();
        } catch (e) {}
        try {
            await env.DB.prepare("ALTER TABLE videos_table ADD COLUMN duration INTEGER DEFAULT 45").run();
        } catch (e) {}
        // Enforce active D1 cloud SQL database binding
        if (!env.DB) {
            return new Response(JSON.stringify({ error: "Cloudflare D1 Database binding 'DB' not configured. Please check your bindings settings." }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // Endpoint routing resolver
        if (path === "login" && method === "POST") {
            const body = await request.json();
            const { idVal, passVal, role } = body;

            const user = await env.DB.prepare(
                "SELECT * FROM students_table WHERE role = ? AND phone = ? AND password = ?"
            ).bind(role, idVal, passVal).first();

            if (!user) {
                return new Response(JSON.stringify({ error: "Access Denied: Invalid credentials." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
            return new Response(JSON.stringify(user), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path === "login-bypass" && method === "POST") {
            // Grab or auto-generate Master Teacher Admin
            let admin = await env.DB.prepare("SELECT * FROM students_table WHERE role = 'admin' LIMIT 1").first();
            if (!admin) {
                await env.DB.prepare(
                    "INSERT INTO students_table (name, phone, password, grade, role, grades_record) VALUES (?, ?, ?, ?, ?, ?)"
                ).bind("Administrator", "admin", "admin", "all", "admin", "[]").run();
                
                admin = await env.DB.prepare("SELECT * FROM students_table WHERE role = 'admin' LIMIT 1").first();
            }
            return new Response(JSON.stringify(admin), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (path.startsWith("students")) {
            const studentId = url.searchParams.get("id");
            if (method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM students_table").all();
                return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const s = await request.json();
                
                // Extremely safe parameter defaults to guarantee D1 binding is never 'undefined'
                const name = s.name !== undefined && s.name !== null ? s.name : "";
                const phone = s.phone !== undefined && s.phone !== null ? s.phone : "";
                const password = s.password !== undefined && s.password !== null ? s.password : "";
                const grade = s.grade !== undefined && s.grade !== null ? s.grade : 7;
                const gender = s.gender !== undefined && s.gender !== null ? s.gender : "male";

                const result = await env.DB.prepare(
                    "INSERT INTO students_table (name, phone, password, grade, role, gender, grades_record) VALUES (?, ?, ?, ?, 'student', ?, '[]')"
                ).bind(name, phone, password, grade, gender).run();
                return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "PUT") {
                const s = await request.json();
                
                const name = s.name !== undefined && s.name !== null ? s.name : "";
                const phone = s.phone !== undefined && s.phone !== null ? s.phone : "";
                const password = s.password !== undefined && s.password !== null ? s.password : "";
                const grade = s.grade !== undefined && s.grade !== null ? s.grade : 7;
                const gender = s.gender !== undefined && s.gender !== null ? s.gender : "male";
                const numericId = studentId && !isNaN(parseInt(studentId)) ? parseInt(studentId) : 0;

                await env.DB.prepare(
                    "UPDATE students_table SET name = ?, phone = ?, password = ?, grade = ?, gender = ? WHERE id = ?"
                ).bind(name, phone, password, grade, gender, numericId).run();
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
            
            // Accept ANY casing of ID/id case-insensitively
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

            const user = await env.DB.prepare("SELECT * FROM students_table WHERE id = ?").bind(parseInt(studentId)).first();
            if (user) {
                // Read columns case-insensitively to align with SQLite varying DB environments
                let currentRole = "student";
                let currentGrade = 7;
                for (const k in user) {
                    if (k.toLowerCase() === "role") currentRole = user[k] || "student";
                    if (k.toLowerCase() === "grade") currentGrade = user[k] || 7;
                }

                const nextRole = currentRole === "admin" ? "student" : "admin";
                const nextGrade = nextRole === "admin" ? "all" : 7;

                // Bind strictly non-undefined variables to prevent D1 binding crashes
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

        if (path === "video-progress" && method === "POST") {
            const body = await request.json();
            const { studentId, videoId, seconds, duration, completed } = body;
            
            const student = await env.DB.prepare("SELECT watched_lessons FROM students_table WHERE id = ?").bind(parseInt(studentId)).first();
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
                return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json", ...corsHeaders } });
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
                return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json", ...corsHeaders } });
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
            const commentId = parseInt(parts[3]);
            const body = await request.json();

            const post = await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(postId).first();
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
            const body = await request.json(); // Contains current user detail
            const post = await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(postId).first();
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
                const student = await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first();
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
                const student = await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first();
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
                const student = await env.DB.prepare("SELECT lecture_notes FROM students_table WHERE id = ?").bind(parseInt(studentId)).first();
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
            const leaderboard = results.map(s => {
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
                const { results } = await env.DB.prepare("SELECT * FROM feed_table ORDER BY id ASC").all();
                // Compile comments for each post
                for (let post of results) {
                    try {
                        post.comments = JSON.parse(post.comments_json || "[]");
                    } catch(e) { post.comments = []; }
                }
                return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            if (method === "POST") {
                const f = await request.json();
                const result = await env.DB.prepare(
                    "INSERT INTO feed_table (author, date, text, attachment_name, image, comments_json) VALUES (?, ?, ?, ?, ?, '[]')"
                ).bind(f.author, f.date, f.text, f.attachment_name, f.image).run();
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
            const post = await env.DB.prepare("SELECT * FROM feed_table WHERE id = ?").bind(body.postId).first();
            if (post) {
                let comments = [];
                try {
                    comments = JSON.parse(post.comments_json || "[]");
                } catch(e) { comments = []; }

                if (body.commentId) {
                    // It is a nested reply to a specific comment
                    const cIdx = comments.findIndex(c => c.id === body.commentId);
                    if (cIdx !== -1) {
                        if (!comments[cIdx].replies) comments[cIdx].replies = [];
                        comments[cIdx].replies.push({
                            id: Date.now(),
                            author: body.author,
                            authorGrade: body.authorGrade,
                            authorRole: body.authorRole,
                            text: body.text
                        });
                    }
                } else {
                    // It is a top-level comment
                    comments.push({
                        id: Date.now(),
                        author: body.author,
                        authorGrade: body.authorGrade,
                        authorRole: body.authorRole,
                        text: body.text,
                        likes: [],
                        replies: []
                    });
                }
                
                await env.DB.prepare("UPDATE feed_table SET comments_json = ? WHERE id = ?").bind(
                    JSON.stringify(comments), body.postId
                ).run();

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
        }

        

        if (path === "export" && method === "GET") {
            const students = (await env.DB.prepare("SELECT * FROM students_table").all()).results;
            const videos = (await env.DB.prepare("SELECT * FROM videos_table").all()).results;
            const feed = (await env.DB.prepare("SELECT * FROM feed_table").all()).results;
            const materials = (await env.DB.prepare("SELECT * FROM materials_table").all()).results;
            return new Response(JSON.stringify({ students, videos, feed, materials }), {
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
