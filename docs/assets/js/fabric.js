import * as THREE from './three.module.js';
import { GUI } from './dat.gui.module.js';

var params = {
    enableWind: true,
    showBall: true,
    // togglePins: togglePins
};

var DAMPING = 0.03;
// var DAMPING = 0.01;
var DRAG = 1 - DAMPING;
var MASS = 0.91;
// var restDistance = 60;
var restDistance = 60;

// var xSegs = window.innerWidth / 2;
// var ySegs = 50;

var xSegs = 30;
var ySegs = 20;

var clothFunction = plane( restDistance * xSegs, restDistance * ySegs );

var cloth = new Cloth( xSegs, ySegs );

// var GRAVITY = 981 * 1.4;
var GRAVITY = 981 * 1.4;

var gravity = new THREE.Vector3( 0, - GRAVITY, 0 ).multiplyScalar( MASS );

var TIMESTEP = 18 / 1100;
var TIMESTEP_SQ = TIMESTEP * TIMESTEP;

var pins = [];

var windForce = new THREE.Vector3( 0, 0, 0 );

var ballPosition = new THREE.Vector3( 0, - 45, 0 );
var ballSize = window.innerHeight / 8;

var tmpForce = new THREE.Vector3();

var backgroundColor = 0xffffff; 
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var clothPath = 'assets/images/textures/memphis_72_ppi_4_rpt.jpg';
var clothPathNormalMap = 'assets/images/textures/memphis_72_ppi_4_rpt_normal.jpg';

var clothPathNormalMap = 'assets/images/textures/memphis_72_ppi_4_rpt_norm_4.jpg';
var floorPosition = - window.innerHeight / 2;
var ceilingPosition = window.innerHeight / 2 + window.innerHeight;

var theta = 0;

function plane( width, height ) {

    return function ( u, v, target ) {

        var x = ( u - 0.5 ) * width;
        var y = ( v + 0.5 ) * height;
        var z = 0;

        target.set( x, y, z );

    };

}

function Particle( x, y, z, mass ) {

    this.position = new THREE.Vector3();
    this.previous = new THREE.Vector3();
    this.original = new THREE.Vector3();
    this.a = new THREE.Vector3( 0, 0, 0 ); // acceleration
    this.mass = mass;
    this.invMass = 1 / mass;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();

    // init

    clothFunction( x, y, this.position ); // position
    clothFunction( x, y, this.previous ); // previous
    clothFunction( x, y, this.original );

}

// Force -> Acceleration

Particle.prototype.addForce = function ( force ) {

    this.a.add(
        this.tmp2.copy( force ).multiplyScalar( this.invMass )
    );

};


// Performs Verlet integration

Particle.prototype.integrate = function ( timesq ) {

    var newPos = this.tmp.subVectors( this.position, this.previous );
    newPos.multiplyScalar( DRAG ).add( this.position );
    newPos.add( this.a.multiplyScalar( timesq ) );

    this.tmp = this.previous;
    this.previous = this.position;
    this.position = newPos;

    this.a.set( 0, 0, 0 );

};


var diff = new THREE.Vector3();

function satisfyConstraints( p1, p2, distance ) {

    diff.subVectors( p2.position, p1.position );
    var currentDist = diff.length();
    if ( currentDist === 0 ) return; // prevents division by 0
    var correction = diff.multiplyScalar( 1 - distance / currentDist );
    var correctionHalf = correction.multiplyScalar( 0.5 );
    p1.position.add( correctionHalf );
    p2.position.sub( correctionHalf );

}


function Cloth( w, h ) {

    // w = w || 10;
    // h = h || 10;
    w = w;
    h = h;
    this.w = w;
    this.h = h;

    var particles = [];
    var constraints = [];

    var u, v;

    // Create particles
    for ( v = 0; v <= h; v ++ ) {

        for ( u = 0; u <= w; u ++ ) {

            particles.push(
                new Particle( u / w, v / h, 0, MASS )
            );

        }

    }

    // Structural

    for ( v = 0; v < h; v ++ ) {

        for ( u = 0; u < w; u ++ ) {

            constraints.push( [
                particles[ index( u, v ) ],
                particles[ index( u, v + 1 ) ],
                restDistance
            ] );

            constraints.push( [
                particles[ index( u, v ) ],
                particles[ index( u + 1, v ) ],
                restDistance
            ] );

        }

    }

    for ( u = w, v = 0; v < h; v ++ ) {

        constraints.push( [
            particles[ index( u, v ) ],
            particles[ index( u, v + 1 ) ],
            restDistance

        ] );

    }

    for ( v = h, u = 0; u < w; u ++ ) {

        constraints.push( [
            particles[ index( u, v ) ],
            particles[ index( u + 1, v ) ],
            restDistance
        ] );

    }

    this.particles = particles;
    this.constraints = constraints;

    function index( u, v ) {

        return u + v * ( w + 1 );

    }

    this.index = index;

}

function simulate( now ) {

    var windStrength = Math.cos( now / 7000 ) * 400 + 40;

    windForce.set( Math.sin( now / 20000 ), Math.cos( now / 30000 ), Math.sin( now / 10000 ) );
    windForce.normalize();
    windForce.multiplyScalar( windStrength );

    var i, j, il, particles, particle, constraints, constraint;

    // Aerodynamics forces

    if ( params.enableWind ) {

        var indx;
        var normal = new THREE.Vector3();
        var indices = clothGeometry.index;
        var normals = clothGeometry.attributes.normal;

        particles = cloth.particles;

        for ( i = 0, il = indices.count; i < il; i += 6 ) {

            for ( j = 0; j < 6; j ++ ) {

                indx = indices.getX( i + j );
                normal.fromBufferAttribute( normals, indx );
                tmpForce.copy( normal ).normalize().multiplyScalar( normal.dot( windForce ) );
                particles[ indx ].addForce( tmpForce );

            }

        }

    }

    for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {

        particle = particles[ i ];
        particle.addForce( gravity );

        particle.integrate( TIMESTEP_SQ );

    }

    // Start Constraints

    constraints = cloth.constraints;
    il = constraints.length;

    for ( i = 0; i < il; i ++ ) {

        constraint = constraints[ i ];
        satisfyConstraints( constraint[ 0 ], constraint[ 1 ], constraint[ 2 ] );

    }

    // Ball Constraints

    // ballPosition = new THREE.Vector3( ((mouse.x) / 2) * window.innerWidth, ((mouse.y)/2) * window.innerHeight, 1.0 );
    if ( params.showBall ) {

        // find intersections
        // sphere.visible = true;

        raycaster.setFromCamera( mouse, camera );

        var intersects = raycaster.intersectObject( object, true );

        if ( intersects.length > 0 ) {
            sphere.scale.set(ballSize, ballSize, ballSize);
            ballPosition = intersects[ 0 ].point;
            
            for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {

                particle = particles[ i ];
                var pos = particle.position;

                diff.subVectors( pos, ballPosition );
                if ( diff.length() < ballSize ) {
                    // collided
                    diff.normalize().multiplyScalar( ballSize );
                    pos.copy( ballPosition ).add( diff );
                }

            }

        } else {
            // sphere.scale.set(0, 0, 0);
        }


    } else {
        sphere.visible = true;
    }


    // Ceiling/Floor Constraints

    for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {

        particle = particles[ i ];
        pos = particle.position;
        
        if ( pos.y < floorPosition ) {
            // pos.y = floorPosition;
        } else {
            if (pos.y > ceilingPosition) {
                // pos.y = ceilingPosition;
            }
        }
    }

    // Pin Constraints

    for ( i = 0, il = pins.length; i < il; i ++ ) {

        var xy = pins[ i ];
        var p = particles[ xy ];
        p.position.copy( p.original );
        p.previous.copy( p.original );

    }


}

/* testing cloth simulation */

var pinsFormation = [];
var pins = [ 0 ];

pinsFormation.push( pins );

pins = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
pinsFormation.push( pins );

pins = [ 0 ];
pinsFormation.push( pins );

pins = []; // cut the rope ;)
pinsFormation.push( pins );

pins = [ 0, cloth.w ]; // classic 2 pins
pinsFormation.push( pins );

// pins = pinsFormation[ 3 ];
pins = [ 0, cloth.h, cloth.w ];

// function togglePins() {

//     pins = pinsFormation[ ~ ~ ( Math.random() * pinsFormation.length ) ];

// }

// var container, stats;
var container;
var camera, scene, renderer;

var clothGeometry;
var sphere;
var object;

init();
animate( 0 );

function init() {

    container = document.getElementById('hero-canvas');

    // scene
    scene = new THREE.Scene();
    var loader = new THREE.TextureLoader();

    scene.background = new THREE.Color( backgroundColor );
    // scene.fog = new THREE.Fog( 0xcce0ff, 500, 10000 );

    // camera
    camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 10000 );
    // camera.position.set( 1000, 50, 1500 );
    camera.position.set( -100, 0, 2200 );

    // camera.position.set( 0, 900, 2000 );
    // x: 201.21656221334072, y: 909.328513842752, z: 1993.845696252871

    // lights
    scene.add( new THREE.AmbientLight( 0x666666 ) );
    var light = new THREE.DirectionalLight( 0xdfebff, 1 );
    light.position.set( 50, 200, 100 );
    light.position.multiplyScalar( 1.3 );

    light.castShadow = false;

    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    var d = 300;

    light.shadow.camera.left = - d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = - d;

    light.shadow.camera.far = 1000;

    scene.add( light );

    // cloth material
    var clothTexture = loader.load(clothPath);
    clothTexture.anisotropy = 1;

    var normalMap = loader.load(clothPathNormalMap);

    var clothMaterial = new THREE.MeshPhongMaterial( {
        map: clothTexture,
        side: THREE.DoubleSide,
        alphaTest: 0.5
    } );

    clothMaterial.map.wrapS = clothMaterial.map.wrapT = THREE.RepeatWrapping;

    // Now we only need to set a new map.repeat
    clothMaterial.map.repeat.set( 1, 1 );

    clothMaterial.normalMap = normalMap;

    clothMaterial.normalMap.wrapS = clothMaterial.normalMap.wrapT = THREE.ClampToEdgeWrapping;
    clothMaterial.normalMap.repeat.set( 1, 1 );
    
    // cloth geometry
    clothGeometry = new THREE.ParametricBufferGeometry( clothFunction, cloth.w, cloth.h );

    // cloth mesh
    object = new THREE.Mesh( clothGeometry, clothMaterial );
    object.position.set(0, 0, 0);
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add( object );

    object.customDepthMaterial = new THREE.MeshDepthMaterial( {
        depthPacking: THREE.RGBADepthPacking,
        map: clothTexture,
        alphaTest: 0.5
    } );

    // sphere

    var ballGeo = new THREE.SphereBufferGeometry( ballSize, 32, 16 );
    var ballMaterial = new THREE.MeshLambertMaterial();

    sphere = new THREE.Mesh( ballGeo, ballMaterial );
    sphere.castShadow = false;
    sphere.receiveShadow = false;
    sphere.visible = false;
    scene.add( sphere );

    // ground

    // var groundTexture = loader.load( '/assets/images/textures/normal_yarn_texture.jpg' );
    // var groundTexture = new THREE.Color( backgroundColor );
    // groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    // groundTexture.repeat.set( 25, 25 );
    // groundTexture.anisotropy = 16;
    // groundTexture.encoding = THREE.sRGBEncoding;

    // var groundMaterial = new THREE.MeshLambertMaterial( { map: groundTexture } );
    // var groundMaterial = new THREE.MeshBasicMaterial();
    // groundMaterial.color = backgroundColor;

    // // var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 20000, 20000 ), groundMaterial );
    // var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 20000, 20000 ) );
    // // var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( window.innerWidth, window.innerHeight ), groundMaterial );
    // mesh.position.y = floorPosition;
    // mesh.rotation.x = - Math.PI / 2;
    // mesh.receiveShadow = true;
    // scene.add( mesh );

    // poles

    // var poleGeo = new THREE.BoxBufferGeometry( 5, 375, 5 );
    // var poleMat = new THREE.MeshLambertMaterial();

    // var mesh = new THREE.Mesh( poleGeo, poleMat );
    // mesh.position.x = - 125;
    // mesh.position.y = - 62;
    // mesh.receiveShadow = true;
    // mesh.castShadow = true;
    // scene.add( mesh );

    // var mesh = new THREE.Mesh( poleGeo, poleMat );
    // mesh.position.x = 125;
    // mesh.position.y = - 62;
    // mesh.receiveShadow = true;
    // mesh.castShadow = true;
    // scene.add( mesh );

    // var mesh = new THREE.Mesh( new THREE.BoxBufferGeometry( 255, 5, 5 ), poleMat );
    // mesh.position.y = - 250 + ( 750 / 2 );
    // mesh.position.x = 0;
    // mesh.receiveShadow = true;
    // mesh.castShadow = true;
    // scene.add( mesh );

    // var gg = new THREE.BoxBufferGeometry( 10, 10, 10 );
    // var mesh = new THREE.Mesh( gg, poleMat );
    // mesh.position.y = - 250;
    // mesh.position.x = 125;
    // mesh.receiveShadow = true;
    // mesh.castShadow = true;
    // scene.add( mesh );

    // var mesh = new THREE.Mesh( gg, poleMat );
    // mesh.position.y = - 250;
    // mesh.position.x = - 125;
    // mesh.receiveShadow = true;
    // mesh.castShadow = true;
    // scene.add( mesh );

    // renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

    container.appendChild( renderer.domElement );

    renderer.outputEncoding = THREE.sRGBEncoding;

    renderer.shadowMap.enabled = true;

    // controls
    // var controls = new OrbitControls( camera, renderer.domElement );
    // controls.maxPolarAngle = Math.PI * 0.5;
    // controls.minDistance = 1000;
    // controls.maxDistance = 5000;

    // performance monitor

    // stats = new Stats();
    // container.appendChild( stats.dom );

    window.addEventListener( 'resize', onWindowResize, false );

    mouse = new THREE.Vector2();

    // var gui = new GUI();
    // gui.add( params, 'enableWind' ).name( 'Enable wind' );
    // gui.add( params, 'showBall' ).name( 'Show ball' );
    // gui.add( params, 'togglePins' ).name( 'Toggle pins' );

    if ( typeof TESTING !== 'undefined' ) {

        for ( var i = 0; i < 50; i ++ ) {

            simulate( 500 - 10 * i );

        }

    }

    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    document.addEventListener( 'mousedown', onDocumentMouseDown, false );
}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}


function onDocumentMouseMove( event ) {

    event.preventDefault();

    mouse.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );
}

function onDocumentMouseDown( event ) {

    event.preventDefault();

    mouse.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );
}


function animate( now ) {

    requestAnimationFrame( animate );
    simulate( now );
    render();
    // stats.update();

}

function render() {

    theta += 0.1;

    // camera.position.x = radius * Math.sin( THREE.MathUtils.degToRad( theta ) );
    // camera.position.y = radius * Math.sin( THREE.MathUtils.degToRad( theta ) );
    // camera.position.z = radius * Math.cos( THREE.MathUtils.degToRad( theta ) );
    // camera.lookAt( scene.position );

    camera.updateMatrixWorld();

    // raycaster.setFromCamera( mouse, camera );

    // var intersects = raycaster.intersectObjects( scene.children );

    // for ( var i = 0; i < intersects.length; i++ ) {

    //     sphere.position.copy( ballPosition );
    //     // intersects[ i ].object.material.color.set( 0xff0000 );

    // }

    var p = cloth.particles;

    for ( var i = 0, il = p.length; i < il; i ++ ) {

        var v = p[ i ].position;

        clothGeometry.attributes.position.setXYZ( i, v.x, v.y, v.z );

    }

    clothGeometry.attributes.position.needsUpdate = true;

    clothGeometry.computeVertexNormals();

    sphere.position.copy( ballPosition );
    // object.possition.set(mouse.x * 100, mouse.y * 100, 0);

    renderer.render( scene, camera );

}