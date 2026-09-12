/**
 * 🚀 CLOUDFLARE PAGES SERVERLESS ROUTER ENGINE (functions/[[path]].js)
 * Architecture: Cloudflare Pages Functions + D1 Database + Secure AI API Proxy + DRM Shield
 * Project: MR. Ahmed Abd-ElFatah - Unified Student Workspace Portal
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 🔒 1. SECURITY & CORS HEADERS
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Helper to produce JSON responses with CORS headers
    const jsonResponse = (data, status = 200) => {
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    };

    // Handle preflight OPTIONS requests immediately
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // 🤖 2. SECURE CEREBRAS & GROQ AI PROXY ENDPOINT (/api/ai/chat)
    // Proxies LLM requests server-side so API keys are never exposed on the frontend!
    if (pathname === '/api/ai/chat' && request.method === 'POST') {
        try {
            const body = await request.json();
            const cerebrasKey = env.CEREBRAS_API_KEY || 'csk-94wjwe23nfwxnypf5yjhpcnfxm9fhdd92tmwm39m35nememm';

            const aiResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cerebrasKey}`
                },
                body: JSON.stringify(body)
            });

            if (aiResponse.ok) {
                const data = await aiResponse.json();
                return jsonResponse(data, 200);
            }

            // Fallback to Groq if Cerebras quota is exceeded
            const groqKey = env.GROQ_API_KEY || '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';
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqKey}`
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-120b',
                    messages: body.messages,
                    temperature: body.temperature || 0.7,
                    max_tokens: body.max_tokens || 800
                })
            });

            const groqData = await groqResponse.json();
            return jsonResponse(groqData, groqResponse.status);
        } catch (err) {
            return jsonResponse({ error: err.message }, 500);
        }
    }

    // 🗄️ 3. CLOUDFLARE D1 DATABASE API ENDPOINTS (/api/db/* or /api/*)
    if (pathname.startsWith('/api/db/')) {
        const d1 = env.DB; // Cloudflare D1 binding name

        // --- STUDENTS ENDPOINTS ---
        if (pathname === '/api/db/students') {
            // GET /api/db/students - List all students sorted by EXP and watch time
            if (request.method === 'GET') {
                if (d1) {
                    const { results } = await d1.prepare('SELECT * FROM students ORDER BY xp DESC, watch_mins DESC').all();
                    return jsonResponse(results);
                }
                return jsonResponse([]);
            }

            // POST /api/db/students - Provision new student account or update existing
            if (request.method === 'POST') {
                try {
                    const student = await request.json();
                    if (d1) {
                        await d1.prepare(`
                            INSERT INTO students (id, phone, name, password, grade, gender, title, xp, watch_mins, role, can_post_feed)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                password = excluded.password,
                                grade = excluded.grade,
                                gender = excluded.gender,
                                title = excluded.title,
                                xp = excluded.xp,
                                watch_mins = excluded.watch_mins,
                                role = excluded.role,
                                can_post_feed = excluded.can_post_feed
                        `).bind(
                            student.id,
                            student.phone || student.id,
                            student.name,
                            student.password || '123456',
                            student.grade || 'Grade 10 (Secandory 1)',
                            student.gender || 'Boy',
                            student.title || null,
                            student.xp || 0,
                            student.watch_mins || 0,
                            student.role || 'student',
                            student.can_post_feed ? 1 : 0
                        ).run();
                        return jsonResponse({ success: true, message: 'Student account provisioned in D1.' });
                    }
                    return jsonResponse({ success: true, mock: true });
                } catch (err) {
                    return jsonResponse({ error: err.message }, 400);
                }
            }
        }

        // POST /api/db/students/xp - Grant custom EXP to student
        if (pathname === '/api/db/students/xp' && request.method === 'POST') {
            try {
                const { id, xpAmount } = await request.json();
                if (d1) {
                    await d1.prepare('UPDATE students SET xp = MAX(0, xp + ?) WHERE id = ? OR phone = ?')
                        .bind(xpAmount, id, id).run();
                    return jsonResponse({ success: true, message: `Granted ${xpAmount} EXP to student ${id}.` });
                }
                return jsonResponse({ success: true, mock: true });
            } catch (err) {
                return jsonResponse({ error: err.message }, 400);
            }
        }

        // DELETE /api/db/students/:id
        if (pathname.startsWith('/api/db/students/') && request.method === 'DELETE') {
            const studentId = pathname.split('/').pop();
            if (d1 && studentId) {
                await d1.prepare('DELETE FROM students WHERE id = ? OR phone = ?').bind(studentId, studentId).run();
                return jsonResponse({ success: true, message: 'Student record removed.' });
            }
            return jsonResponse({ success: true });
        }

        // --- LECTURES ENDPOINTS ---
        if (pathname === '/api/db/lectures') {
            // GET /api/db/lectures
            if (request.method === 'GET') {
                if (d1) {
                    const { results } = await d1.prepare('SELECT * FROM lectures ORDER BY id ASC').all();
                    return jsonResponse(results);
                }
                return jsonResponse([]);
            }

            // POST /api/db/lectures - Register new lecture
            if (request.method === 'POST') {
                try {
                    const lec = await request.json();
                    if (d1) {
                        await d1.prepare(`
                            INSERT INTO lectures (id, title, description, archive_url, duration_mins, grade, watched_mins, completed)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            lec.id || Date.now(),
                            lec.title,
                            lec.description,
                            lec.archive_url,
                            lec.duration_mins || 45,
                            lec.grade || 'Grade 10 (Secandory 1)',
                            0,
                            0
                        ).run();
                        return jsonResponse({ success: true, message: 'Lecture registered in D1.' });
                    }
                    return jsonResponse({ success: true, mock: true });
                } catch (err) {
                    return jsonResponse({ error: err.message }, 400);
                }
            }
        }

        // DELETE /api/db/lectures/:id
        if (pathname.startsWith('/api/db/lectures/') && request.method === 'DELETE') {
            const lecId = pathname.split('/').pop();
            if (d1 && lecId) {
                await d1.prepare('DELETE FROM lectures WHERE id = ?').bind(lecId).run();
                return jsonResponse({ success: true, message: 'Lecture deleted.' });
            }
            return jsonResponse({ success: true });
        }

        // --- MATERIALS ENDPOINTS ---
        if (pathname === '/api/db/materials') {
            // GET /api/db/materials
            if (request.method === 'GET') {
                if (d1) {
                    const { results } = await d1.prepare('SELECT * FROM materials ORDER BY id DESC').all();
                    return jsonResponse(results);
                }
                return jsonResponse([]);
            }

            // POST /api/db/materials - Upload/publish material sheet
            if (request.method === 'POST') {
                try {
                    const mat = await request.json();
                    if (d1) {
                        await d1.prepare(`
                            INSERT INTO materials (id, title, type, grade, file_url, uploaded_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `).bind(
                            mat.id || Date.now(),
                            mat.title,
                            mat.type || 'Worksheet',
                            mat.grade || 'Grade 10 (Secandory 1)',
                            mat.file_url,
                            mat.uploaded_at || new Date().toISOString().split('T')[0]
                        ).run();
                        return jsonResponse({ success: true, message: 'Study material uploaded.' });
                    }
                    return jsonResponse({ success: true, mock: true });
                } catch (err) {
                    return jsonResponse({ error: err.message }, 400);
                }
            }
        }

        // DELETE /api/db/materials/:id
        if (pathname.startsWith('/api/db/materials/') && request.method === 'DELETE') {
            const matId = pathname.split('/').pop();
            if (d1 && matId) {
                await d1.prepare('DELETE FROM materials WHERE id = ?').bind(matId).run();
                return jsonResponse({ success: true, message: 'Material deleted.' });
            }
            return jsonResponse({ success: true });
        }

        // --- COMMUNITY FEED ENDPOINTS ---
        if (pathname === '/api/db/feed') {
            // GET /api/db/feed
            if (request.method === 'GET') {
                if (d1) {
                    const { results } = await d1.prepare('SELECT * FROM feed_posts ORDER BY id DESC').all();
                    return jsonResponse(results);
                }
                return jsonResponse([]);
            }

            // POST /api/db/feed - Broadcast announcement
            if (request.method === 'POST') {
                try {
                    const post = await request.json();
                    if (d1) {
                        await d1.prepare(`
                            INSERT INTO feed_posts (id, author, xp, level_title, role, date, text, attachment_type, attachment_name, likes, comments_json)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            post.id || Date.now(),
                            post.author,
                            post.xp || 0,
                            post.levelTitle || 'Novice Scientist 🟢',
                            post.role || 'Student',
                            post.date || 'Today',
                            post.text,
                            post.attachmentType || null,
                            post.attachmentName || null,
                            0,
                            JSON.stringify(post.comments || [])
                        ).run();
                        return jsonResponse({ success: true, message: 'Feed post broadcasted.' });
                    }
                    return jsonResponse({ success: true, mock: true });
                } catch (err) {
                    return jsonResponse({ error: err.message }, 400);
                }
            }
        }

        // --- PORTAL FEEDBACKS ENDPOINTS ---
        if (pathname === '/api/db/feedbacks') {
            // GET /api/db/feedbacks
            if (request.method === 'GET') {
                if (d1) {
                    const { results } = await d1.prepare('SELECT * FROM portal_feedbacks ORDER BY id DESC').all();
                    return jsonResponse(results);
                }
                return jsonResponse([]);
            }

            // POST /api/db/feedbacks
            if (request.method === 'POST') {
                try {
                    const fb = await request.json();
                    if (d1) {
                        await d1.prepare(`
                            INSERT INTO portal_feedbacks (id, author, gender, id_val, rating, text, date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                rating = excluded.rating,
                                text = excluded.text,
                                date = excluded.date
                        `).bind(
                            fb.id || Date.now(),
                            fb.author,
                            fb.gender || 'Boy',
                            fb.idVal || 'guest',
                            fb.rating || 0,
                            fb.text,
                            fb.date || 'Today'
                        ).run();
                        return jsonResponse({ success: true, message: 'Feedback review submitted.' });
                    }
                    return jsonResponse({ success: true, mock: true });
                } catch (err) {
                    return jsonResponse({ error: err.message }, 400);
                }
            }
        }

        // DELETE /api/db/feedbacks/:id
        if (pathname.startsWith('/api/db/feedbacks/') && request.method === 'DELETE') {
            const fbId = pathname.split('/').pop();
            if (d1 && fbId) {
                await d1.prepare('DELETE FROM portal_feedbacks WHERE id = ?').bind(fbId).run();
                return jsonResponse({ success: true, message: 'Feedback removed.' });
            }
            return jsonResponse({ success: true });
        }

        // --- RAW SQL DIRECTIVE CONSOLE ENDPOINT ---
        // POST /api/db/query (Execute SQL for Admin Console)
        if (pathname === '/api/db/query' && request.method === 'POST') {
            try {
                const { sql } = await request.json();
                if (d1) {
                    const result = await d1.prepare(sql).all();
                    return jsonResponse(result);
                }
                return jsonResponse({ results: [], message: 'Simulated D1 Executor Active.' });
            } catch (err) {
                return jsonResponse({ error: err.message }, 400);
            }
        }
    }

    // 🌐 4. STATIC ASSET PASS-THROUGH & SPA ROUTING FALLBACK
    try {
        const response = await env.ASSETS.fetch(request);
        
        // Inject security headers on static responses
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (e) {
        // Fallback to static index.html for Single Page Application navigation
        return env.ASSETS.fetch(new URL('/', request.url));
    }
}
