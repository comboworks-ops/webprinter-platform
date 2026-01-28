import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Create Admin User Function Invoked")

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    try {
        const { email, password } = await req.json()
        console.log(`Creating admin user: ${email}`)

        if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password required" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Create User (or get ID if exists)
        let userId

        // Check if user exists first to avoid error spam
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        const existingUser = users.find(u => u.email === email)

        if (existingUser) {
            console.log("User already exists, using existing ID")
            userId = existingUser.id
        } else {
            console.log("Creating new user")
            const { data: userData, error: createError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            })
            if (createError) throw createError
            userId = userData.user?.id
        }

        if (!userId) throw new Error("Could not obtain User ID")

        console.log(`User ID: ${userId}. Assigning admin role...`)

        // 2. Assign Role
        const { error: roleError } = await supabase
            .from('user_roles')
            .upsert(
                { user_id: userId, role: 'admin' },
                { onConflict: 'user_id, role' }
            )

        if (roleError) throw roleError

        console.log("Success!")
        return new Response(
            JSON.stringify({
                success: true,
                message: `Admin user ${email} created/updated successfully`,
                userId
            }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (err) {
        console.error("Error:", err.message)
        return new Response(
            JSON.stringify({ error: err.message }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
})
