
const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase keys')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSignup() {
    const email = `test.debug.${Date.now()}@example.com`
    const password = 'password123'
    const displayName = 'Debug User JS'

    console.log(`Attempting signup for ${email}...`)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: displayName,
            },
        },
    })

    if (error) {
        console.error('Signup Error:', JSON.stringify(error, null, 2))
    } else {
        console.log('Signup Success:', data)
    }
}

testSignup()
